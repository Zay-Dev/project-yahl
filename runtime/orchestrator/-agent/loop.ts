import type { TRunYahl, TStorage, TLoopMeta } from './-types';

import { filterContextByReadUsage } from './-utils';

type TMyLoopMeta = TLoopMeta & { indexName: string };

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
  yahl: string,
  storage: TStorage,
  loopMeta: TMyLoopMeta,
  runner: TRunYahl,
  temperature?: number,
) => {
  const lines = yahl.split("\n");
  const firstLine = lines[0];
  const mode = firstLine.match(/\s+[A-Z_]+:\s*{/)?.[0]?.replace("{", "") || "";

  const normalizedYahl = `${mode} ${yahl.substring(yahl.indexOf("{"))}`;

  const isExtends = (key: string) =>
    yahl.match(new RegExp(`\\s*EXTENDS:\\s*${key}\\s*=`));

  const stageInput = Object
    .entries({
      ...filterContextByReadUsage(normalizedYahl, storage.context),

      [loopMeta.indexName]: loopMeta.value,
    })
    .filter(([key]) => !isExtends(key));

  const result = await runner(
    normalizedYahl,
    {
      loopMeta,
      temperature,
      useStorage: () => ({
        context: new Map(stageInput),
        types: storage.types,
      }),
    },
  );

  const globalContext = storage.context;
  const loopContext = result.storage.context;

  for (const key of loopContext.keys()) {
    if (globalContext.has(key)) {
      globalContext.set(
        key,
        isExtends(key)
          ? [globalContext.get(key), loopContext.get(key)]
          : loopContext.get(key),
      );
    }
  }
};

export const handleLoop = async (
  yahl: string,
  storage: TStorage,
  runner: TRunYahl,
  temperature?: number,
) => {
  const loopSetup = _parseLoop(yahl, storage);
  if (!loopSetup) {
    console.error(yahl);
    throw new Error("Invalid loop setup occurred in the above stage");
  }

  const { indexName, startAt, endAfter, step, array } = loopSetup;
  let i = startAt;

  while (step >= 0 ? i <= endAfter : i >= endAfter) {
    const currentValue = !!array ? array[i] || null : i;

    const loopMeta: TMyLoopMeta = {
      indexName,
      temperature,

      index: i,
      value: currentValue,
      arraySnapshot: array ? JSON.parse(JSON.stringify(array)) : [],
    };

    await _runLoopIteration(yahl, storage, loopMeta, runner, temperature);

    i += step;
  }
};
