import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { TRunYahl, TStorage } from './-types';
import type { ParsedStage } from '@/orchestrator/-utils/yahl/types';
import type { ChatAssistantMessage } from '@/shared/stage-tools';

import { compileStage } from '@/orchestrator/-utils/yahl';

import { handleWhile, resumeWhileFromCheckpoint } from './while';

const storageFrom = (context: Record<string, unknown>): TStorage => ({
  context: new Map(Object.entries(context)),
  types: new Map(),
});

const whileStage = (overrides: Partial<ParsedStage['spec']> = {}): ParsedStage =>
  compileStage({
    contextKeys: ['c'],
    logic: 'c += 1;',
    maxTurns: 5,
    produceContextKeys: ['c'],
    updateContextKeys: ['c'],
    whileSetup: 'context.context.c < 3',
    ...overrides,
  }, 1);

const warmupPrefix: ChatAssistantMessage[] = [{
  content: 'warmup transcript',
  response: {} as ChatAssistantMessage['response'],
  role: 'assistant',
}];

describe('handleWhile', () => {
  it('runs warmUp once then iterations until the predicate is false', async () => {
    const kinds: string[] = [];
    const logics: string[] = [];

    const runner: TRunYahl = async (_yahl, options) => {
      kinds.push(String(options?.loopMeta?.kind ?? ''));
      logics.push(options?.stages?.[0]?.spec.logic ?? '');

      const nested = options?.useStorage?.() ?? storageFrom({});
      const current = Number(nested.context.get('c') ?? 0);
      nested.context.set('c', current + 1);

      return {
        requestId: `r-${kinds.length}`,
        storage: nested,
        usage: { bashCalls: 0, turns: 1 },
      };
    };

    const storage = storageFrom({ c: 0 });

    await handleWhile(
      whileStage({
        warmUp: 'c += 0;',
        whileSetup: 'context.context.c < 3',
      }),
      storage,
      runner,
    );

    assert.deepEqual(kinds, ['warmup', 'while', 'while']);
    assert.equal(logics[0], 'c += 0;');
    assert.equal(storage.context.get('c'), 3);
  });

  it('stops when remaining turns are exhausted', async () => {
    let iterations = 0;

    const runner: TRunYahl = async (_yahl, options) => {
      iterations += 1;
      const nested = options?.useStorage?.() ?? storageFrom({});
      nested.context.set('c', Number(nested.context.get('c') ?? 0) + 1);

      return {
        storage: nested,
        usage: { bashCalls: 0, turns: 2 },
      };
    };

    const storage = storageFrom({ c: 0 });

    await handleWhile(
      whileStage({
        maxTurns: 3,
        whileSetup: 'true',
      }),
      storage,
      runner,
    );

    assert.equal(iterations, 2);
  });

  it('aborts remaining iterations on gotoTargetStageIndex', async () => {
    let iterations = 0;

    const runner: TRunYahl = async (_yahl, options) => {
      iterations += 1;
      const nested = options?.useStorage?.() ?? storageFrom({});

      return {
        gotoTargetStageIndex: 2,
        storage: nested,
        usage: { bashCalls: 0, turns: 1 },
      };
    };

    const result = await handleWhile(
      whileStage({ whileSetup: 'true' }),
      storageFrom({ c: 0 }),
      runner,
    );

    assert.equal(iterations, 1);
    assert.equal(result.gotoTargetStageIndex, 2);
  });

  it('runs the body once when the predicate is false', async () => {
    let iterations = 0;

    const runner: TRunYahl = async (_yahl, options) => {
      iterations += 1;
      return {
        storage: options?.useStorage?.() ?? storageFrom({}),
        usage: { bashCalls: 0, turns: 1 },
      };
    };

    await handleWhile(
      whileStage({ whileSetup: 'false' }),
      storageFrom({ c: 0 }),
      runner,
    );

    assert.equal(iterations, 1);
  });

  it('runs doAtLeast bodies even when the predicate is false', async () => {
    const indexes: number[] = [];

    const runner: TRunYahl = async (_yahl, options) => {
      indexes.push(options?.loopMeta?.index ?? -1);
      return {
        storage: options?.useStorage?.() ?? storageFrom({}),
        usage: { bashCalls: 0, turns: 1 },
      };
    };

    await handleWhile(
      whileStage({
        whileSetup: { condition: 'false', doAtLeast: 2 },
      }),
      storageFrom({ c: 0 }),
      runner,
    );

    assert.deepEqual(indexes, [0, 1]);
  });

  it('strips verify on warmUp and each iteration', async () => {
    const verifies: unknown[] = [];

    const runner: TRunYahl = async (_yahl, options) => {
      verifies.push(options?.stages?.[0]?.spec.verify);
      const nested = options?.useStorage?.() ?? storageFrom({});
      nested.context.set('c', Number(nested.context.get('c') ?? 0) + 1);

      return {
        storage: nested,
        usage: { bashCalls: 0, turns: 1 },
      };
    };

    await handleWhile(
      whileStage({
        verify: {
          autoRetry: true,
          defId: 'stage-verify',
          minScore: 0.75,
          rubric: 'Pass when c is set.',
        },
        whileSetup: 'false',
      }),
      storageFrom({ c: 0 }),
      runner,
    );

    assert.deepEqual(verifies, [undefined]);
  });

  it('prefixes the same warmUp transcript onto every poll', async () => {
    const prefixes: unknown[] = [];
    const loaded: string[] = [];

    const runner: TRunYahl = async (_yahl, options) => {
      prefixes.push(options?.prefixMessages);
      const nested = options?.useStorage?.() ?? storageFrom({});
      nested.context.set('c', Number(nested.context.get('c') ?? 0) + 1);

      return {
        requestId: options?.loopMeta?.kind === 'warmup' ? 'warm-1' : `poll-${options?.loopMeta?.index}`,
        storage: nested,
        usage: { bashCalls: 0, turns: 1 },
      };
    };

    await handleWhile(
      whileStage({
        warmUp: 'c += 0;',
        whileSetup: 'context.context.c < 3',
      }),
      storageFrom({ c: 0 }),
      runner,
      undefined,
      undefined,
      undefined,
      {
        loadPrefixMessages: async (requestId) => {
          loaded.push(String(requestId ?? ''));
          return warmupPrefix;
        },
      },
    );

    assert.deepEqual(loaded, ['warm-1']);
    assert.equal(prefixes[0], undefined);
    assert.deepEqual(prefixes[1], warmupPrefix);
    assert.deepEqual(prefixes[2], warmupPrefix);
  });
});

describe('resumeWhileFromCheckpoint', () => {
  it('continues from the next while index after a completed iteration', async () => {
    const indexes: number[] = [];

    const runner: TRunYahl = async (_yahl, options) => {
      indexes.push(options?.loopMeta?.index ?? -1);
      const nested = options?.useStorage?.() ?? storageFrom({});
      nested.context.set('c', Number(nested.context.get('c') ?? 0) + 1);

      return {
        storage: nested,
        usage: { bashCalls: 0, turns: 1 },
      };
    };

    await resumeWhileFromCheckpoint(
      whileStage({ maxTurns: 5, whileSetup: 'true' }),
      storageFrom({ c: 0 }),
      {
        arraySnapshot: [],
        index: 0,
        kind: 'while',
        remainingBashCalls: 24,
        remainingTurns: 3,
        value: 0,
      },
      runner,
    );

    assert.deepEqual(indexes, [1, 2]);
  });

  it('runs the first body after warmup without re-checking the predicate', async () => {
    let iterations = 0;

    const runner: TRunYahl = async (_yahl, options) => {
      iterations += 1;
      return {
        storage: options?.useStorage?.() ?? storageFrom({}),
        usage: { bashCalls: 0, turns: 1 },
      };
    };

    await resumeWhileFromCheckpoint(
      whileStage({ whileSetup: 'false' }),
      storageFrom({ c: 0 }),
      {
        arraySnapshot: [],
        index: 0,
        kind: 'warmup',
        remainingBashCalls: 24,
        remainingTurns: 5,
        value: null,
      },
      runner,
    );

    assert.equal(iterations, 1);
  });

  it('does not force another body after a completed poll', async () => {
    let iterations = 0;

    const runner: TRunYahl = async (_yahl, options) => {
      iterations += 1;
      return {
        storage: options?.useStorage?.() ?? storageFrom({}),
        usage: { bashCalls: 0, turns: 1 },
      };
    };

    await resumeWhileFromCheckpoint(
      whileStage({ whileSetup: 'false' }),
      storageFrom({ c: 0 }),
      {
        arraySnapshot: [],
        index: 0,
        kind: 'while',
        remainingBashCalls: 24,
        remainingTurns: 5,
        value: 0,
      },
      runner,
    );

    assert.equal(iterations, 0);
  });

  it('forces remaining floor bodies after a completed poll', async () => {
    let iterations = 0;

    const runner: TRunYahl = async (_yahl, options) => {
      iterations += 1;
      return {
        storage: options?.useStorage?.() ?? storageFrom({}),
        usage: { bashCalls: 0, turns: 1 },
      };
    };

    await resumeWhileFromCheckpoint(
      whileStage({
        whileSetup: { condition: 'false', doAtLeast: 2 },
      }),
      storageFrom({ c: 0 }),
      {
        arraySnapshot: [],
        index: 0,
        kind: 'while',
        remainingBashCalls: 24,
        remainingTurns: 5,
        value: 0,
      },
      runner,
    );

    assert.equal(iterations, 1);
  });

  it('reuses the warmup prefix on later polls', async () => {
    const prefixes: unknown[] = [];

    const runner: TRunYahl = async (_yahl, options) => {
      prefixes.push(options?.prefixMessages);
      const nested = options?.useStorage?.() ?? storageFrom({});
      nested.context.set('c', Number(nested.context.get('c') ?? 0) + 1);

      return {
        storage: nested,
        usage: { bashCalls: 0, turns: 1 },
      };
    };

    await resumeWhileFromCheckpoint(
      whileStage({ maxTurns: 5, whileSetup: 'true' }),
      storageFrom({ c: 0 }),
      {
        arraySnapshot: [],
        index: 0,
        kind: 'while',
        remainingBashCalls: 24,
        remainingTurns: 3,
        value: 0,
      },
      runner,
      undefined,
      undefined,
      undefined,
      undefined,
      { prefixMessages: warmupPrefix },
    );

    assert.deepEqual(prefixes[0], warmupPrefix);
    assert.deepEqual(prefixes[1], warmupPrefix);
  });
});
