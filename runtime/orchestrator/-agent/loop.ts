import type { TRunYahl, TStorage, TLoopMeta } from './-types';
import type { ParsedStage } from '@/orchestrator/orchestrator-types';

import {
  filterLoopBucket,
  pickContextUpdates,
} from '@/orchestrator/stage-field-policy';

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

    const matchArray = arrayName.match(/\[(\w+)(,[+-]?(\d+))?\]/);

    if (matchArray) {
      const arrayNameInner = matchArray[1];
      const array = storage.context.get(arrayNameInner);

      if (!array || !Array.isArray(array)) return null;

      const step = matchArray[2] ? parseInt(matchArray[2].slice(1)) : 1;

      const startAt = step >= 0 ? 0 : array.length - 1;
      const endAfter = step >= 0 ? array.length - 1 : 0;

      return { startAt, endAfter, step, array };
    }

    return null;
  })();

  if (!loopSetup) return null;

  const { startAt, endAfter, step } = loopSetup;

  if (startAt > endAfter && step > 0) {
    throw new Error(`Invalid range: ${startAt}..${endAfter}, step ${step}`);
  } else if (endAfter > startAt && step < 0) {
    throw new Error(`Invalid range: ${startAt}..${endAfter}, step ${step}`);
  }

  return { indexName, ...loopSetup };
};

const _runLoopIteration = async (
  stage: ParsedStage,
  storage: TStorage,
  loopMeta: TLoopMeta & { indexName: string },
  runner: TRunYahl,
  temperature?: number,
) => {
  const lines = stage.lines;
  const firstLine = lines.split("\n")[0] ?? "";
  const mode = firstLine.match(/\s+[A-Z_]+:\s*{/)?.[0]?.replace("{", "") || "";
  const body = lines.substring(lines.indexOf("{"));
  const compiledBody = mode ? `${mode} ${body}` : body;

  const isExtends = (key: string) => lines.match(new RegExp(`\\s*EXTENDS:\\s*${key}\\s*=`));

  const stageInput = Object
    .entries({
      ...filterLoopBucket(
        compiledBody,
        Object.fromEntries(storage.context),
        stage,
        loopMeta.indexName,
      ),
      [loopMeta.indexName]: loopMeta.value,
    })
    .filter(([key]) => !isExtends(key))
    .reduce((acc, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {} as Record<string, unknown>);

  const result = await runner(
    compiledBody,
    {
      loopMeta: {
        arraySnapshot: loopMeta.arraySnapshot,
        index: loopMeta.index,
        indexName: loopMeta.indexName,
        temperature: loopMeta.temperature,
        value: loopMeta.value,
      },
      temperature,
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
) => {
  const loopSetup = _parseLoop(stage.lines, storage);

  if (!loopSetup) {
    console.error(stage.lines);
    throw new Error("Invalid loop setup occurred in the above stage");
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

    await _runLoopIteration(stage, storage, loopMeta, runner, temperature);

    i += step;
  }
};
