import type { TRunYahl, TStorage, TLoopMeta } from './-types';
import type { ParsedStage } from '@/orchestrator/-utils/yahl/types';

import {
  filterLoopBucket,
  loopIndexNameFromLines,
  pickContextUpdates,
} from '@/orchestrator/-context';
import { toLoopIterationStage } from '@/orchestrator/-utils/yahl';

export const resolveLoopIndexName = (
  stage: ParsedStage,
  loopMeta: TLoopMeta,
) =>
  loopMeta.indexName
  ?? loopIndexNameFromLines(stage.spec.loopSetup ?? '')
  ?? loopIndexNameFromLines(stage.lines);

const resolveContextPath = (storage: TStorage, path: string): unknown => {
  const segments = path.split('.');
  let current: unknown = undefined;

  for (const segment of segments) {
    if (!segment) {
      return undefined;
    }

    if (current === undefined) {
      current = storage.context.get(segment);
      continue;
    }

    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      return undefined;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return current;
};

const _parseLoop = (yahl: string, storage: TStorage) => {
  const matchMeta = yahl.match(/^\s*for each (\w+) of (\[.*\])/i);

  if (!matchMeta) {
    return null;
  }

  const indexName = matchMeta[1];
  const arrayName = matchMeta[2];

  const loopSetup = (() => {
    const matchRange = arrayName.match(/\[(\d+)\.\.(\d+)(,[+-]?(\d+))?\]/);

    if (matchRange) {
      const startAt = parseInt(matchRange[1]);
      const endAfter = parseInt(matchRange[2]);

      const step = matchRange[3] ? parseInt(matchRange[3].slice(1)) :
        (startAt > endAfter ? -1 : 1);

      const array: number[] = [];
      let cursor = startAt;

      while (step >= 0 ? cursor <= endAfter : cursor >= endAfter) {
        array.push(cursor);
        cursor += step;
      }

      return {
        array,
        step: 1,
        startAt: 0,
        endAfter: array.length - 1,
      };
    }

    const matchArray = arrayName.match(/\[([\w.]+)(,[+-]?(\d+))?\]/);

    if (matchArray) {
      const arrayNameInner = matchArray[1];
      const array = resolveContextPath(storage, arrayNameInner);

      if (!array || !Array.isArray(array)) return null;

      const step = matchArray[2] ? parseInt(matchArray[2].slice(1)) : 1;

      const startAt = step >= 0 ? 0 : array.length - 1;
      const endAfter = step >= 0 ? array.length - 1 : 0;

      return { startAt, endAfter, step, array };
    }

    return null;
  })();

  if (!loopSetup) return null;

  const { startAt, endAfter, step, array } = loopSetup;

  if (!array.length) {
    return { array, empty: true, endAfter, indexName, startAt, step };
  }

  if (startAt > endAfter && step > 0) {
    throw new Error(`Invalid range: ${startAt}..${endAfter}, step ${step}`);
  } else if (endAfter > startAt && step < 0) {
    throw new Error(`Invalid range: ${startAt}..${endAfter}, step ${step}`);
  }

  return { indexName, ...loopSetup };
};

export const runLoopIteration = async (
  stage: ParsedStage,
  storage: TStorage,
  loopMeta: TLoopMeta,
  runner: TRunYahl,
  temperature?: number,
  pipelineStageIndex?: number,
  forkSetupIndex?: number,
  parsedStageIndex?: number,
) => {
  const indexName = resolveLoopIndexName(stage, loopMeta);

  if (!indexName) {
    throw new Error(`Missing loop index name for stage at line ${stage.sourceStartLine}`);
  }

  const resolvedLoopMeta = { ...loopMeta, indexName };

  const isExtends = (key: string) =>
    stage.lines.match(new RegExp(`\\s*EXTENDS:\\s*${key}\\s*=`));

  const stageInput = Object
    .entries({
      ...filterLoopBucket(
        stage.spec.logic,
        Object.fromEntries(storage.context),
        stage,
        resolvedLoopMeta.indexName,
      ),
      [resolvedLoopMeta.indexName]: resolvedLoopMeta.value,
    })
    .filter(([key]) => !isExtends(key))
    .reduce((acc, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {} as Record<string, unknown>);

  const result = await runner(
    "",
    {
      forkSetupIndex,
      loopMeta: {
        arraySnapshot: resolvedLoopMeta.arraySnapshot,
        index: resolvedLoopMeta.index,
        indexName: resolvedLoopMeta.indexName,
        temperature: resolvedLoopMeta.temperature,
        value: resolvedLoopMeta.value,
      },
      stages: [toLoopIterationStage(stage, stage.spec.logic)],
      temperature,
      ...(pipelineStageIndex === undefined ? {} : { pipelineStageIndex }),
      ...(parsedStageIndex === undefined ? {} : { parsedStageIndex }),
      useStorage: () => ({
        context: new Map(Object.entries(stageInput)),
        types: storage.types,
      }),
    },
  );

  const globalContext = storage.context;
  const loopContext = pickContextUpdates(
    Object.fromEntries(result.storage.context),
    stage.updateContextKeys,
  );

  for (const key of Object.keys(loopContext)) {
    if (globalContext.has(key)) {
      globalContext.set(
        key,
        isExtends(key)
          ? [globalContext.get(key), loopContext[key]]
          : loopContext[key],
      );
    }
  }
};

export const handleLoop = async (
  stage: ParsedStage,
  storage: TStorage,
  runner: TRunYahl,
  temperature?: number,
  pipelineStageIndex?: number,
) => {
  const loopSetup = _parseLoop(stage.lines, storage);

  if (!loopSetup) {
    console.error(stage.lines);
    throw new Error("Invalid loop setup occurred in the above stage");
  }

  if ('empty' in loopSetup && loopSetup.empty) {
    return;
  }

  const { indexName, startAt, endAfter, step, array } = loopSetup;

  let i = startAt;

  while (step >= 0 ? i <= endAfter : i >= endAfter) {
    const currentValue = !!array ? array[i] || null : i;

    const loopMeta = {
      arraySnapshot: array ? JSON.parse(JSON.stringify(array)) : [],
      index: i,
      indexName,
      temperature,
      value: currentValue,
    };

    await runLoopIteration(
      stage,
      storage,
      loopMeta,
      runner,
      temperature,
      pipelineStageIndex,
      undefined,
      pipelineStageIndex,
    );

    i += step;
  }
};

export const resumeLoopFromCheckpoint = async (
  stage: ParsedStage,
  storage: TStorage,
  completedLoopMeta: TLoopMeta,
  runner: TRunYahl,
  temperature?: number,
  pipelineStageIndex?: number,
  parsedStageIndex?: number,
) => {
  const loopSetup = _parseLoop(stage.lines, storage);

  if (!loopSetup) {
    console.error(stage.lines);
    throw new Error('Invalid loop setup occurred in the above stage');
  }

  if ('empty' in loopSetup && loopSetup.empty) {
    return;
  }

  const { indexName, startAt, endAfter, step, array } = loopSetup;
  let i = completedLoopMeta.index + step;

  while (step >= 0 ? i <= endAfter : i >= endAfter) {
    const currentValue = array ? array[i] || null : i;

    const loopMeta = {
      arraySnapshot: array ? JSON.parse(JSON.stringify(array)) : completedLoopMeta.arraySnapshot,
      index: i,
      indexName: completedLoopMeta.indexName ?? indexName,
      temperature: temperature ?? completedLoopMeta.temperature,
      value: currentValue,
    };

    await runLoopIteration(
      stage,
      storage,
      loopMeta,
      runner,
      temperature,
      pipelineStageIndex,
      undefined,
      parsedStageIndex,
    );

    i += step;
  }
};
