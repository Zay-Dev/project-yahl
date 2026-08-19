import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { TRunYahl, TStorage } from './-types';
import type { TVerifyGateResult } from '@/orchestrator/-verify';

import { compileStage } from '@/orchestrator/-utils/yahl';
import { resolveVerifySkipWarmUp } from '@project-yahl/shared/yahl/verify';

import { handleWhile } from './while';
import {
  isPostLoopWhileResume,
  runWhileWithParentVerify,
} from './while-parent-verify';

const storageFrom = (context: Record<string, unknown>): TStorage => ({
  context: new Map(Object.entries(context)),
  types: new Map(),
});

const parentStage = compileStage({
  logic: 'c += 1;',
  updateContextKeys: ['c'],
  verify: {
    autoRetry: true,
    defId: 'stage-verify',
    minScore: 0.75,
    rubric: 'Pass when c is set.',
  },
  whileSetup: 'false',
}, 12);

const failGate = (): TVerifyGateResult => ({
  failedChecks: [{ id: 'window', reason: 'too short' }],
  feedback: 'fail',
  pass: false,
  resumeAction: 'rerun',
  score: 0.2,
  verifyId: 'v1',
});

const passGate = (): TVerifyGateResult => ({
  feedback: '',
  pass: true,
});

describe('isPostLoopWhileResume', () => {
  it('is true when the checkpoint has no loopMeta', () => {
    assert.equal(isPostLoopWhileResume(undefined), true);
  });

  it('is false when mid-poll loopMeta is present', () => {
    assert.equal(isPostLoopWhileResume({
      arraySnapshot: [],
      index: 0,
      kind: 'while',
      value: 0,
    }), false);
  });
});

describe('runWhileWithParentVerify', () => {
  it('skips persist and verify when the parent has no verify', async () => {
    let loops = 0;
    const persisted: unknown[] = [];

    await runWhileWithParentVerify({
      agentName: 'agent-s',
      firstPass: async () => {
        loops += 1;
        return {};
      },
      hooks: {
        persistStage: (envelope) => {
          persisted.push(envelope);
        },
        runGate: async () => passGate(),
      },
      pipelineStageIndex: 3,
      rerun: async () => {
        throw new Error('rerun should not run');
      },
      sessionId: 's',
      stage: compileStage({
        logic: 'c += 1;',
        whileSetup: 'false',
      }, 1),
      storage: storageFrom({ c: 1 }),
    });

    assert.equal(loops, 1);
    assert.deepEqual(persisted, []);
  });

  it('persists the parent without loopMeta and verifies once', async () => {
    const persisted: {
      context?: { context?: Record<string, unknown> };
      loopMeta?: unknown;
      stage: { verify?: unknown };
    }[] = [];
    let gates = 0;
    let loops = 0;

    await runWhileWithParentVerify({
      agentName: 'agent-s',
      firstPass: async () => {
        loops += 1;
        return {};
      },
      hooks: {
        emitFinish: () => {},
        persistStage: (envelope) => {
          persisted.push(envelope);
        },
        runGate: async () => {
          gates += 1;
          return passGate();
        },
      },
      pipelineStageIndex: 3,
      rerun: async () => {
        throw new Error('rerun should not run');
      },
      sessionId: 's',
      stage: parentStage,
      storage: storageFrom({ c: 1 }),
    });

    assert.equal(loops, 1);
    assert.equal(gates, 1);
    assert.equal(persisted.length, 1);
    assert.equal('loopMeta' in persisted[0]!, false);
    assert.ok(persisted[0]?.stage.verify);
    assert.match(String(persisted[0]?.context?.context?.now_iso), /^\d{4}-\d{2}-\d{2}T/);
    assert.match(String(persisted[0]?.context?.context?.today), /^\d{4}-\d{2}-\d{2}$/);
  });

  it('re-enters the while on fail autoRetry rerun', async () => {
    let first = 0;
    let rerun = 0;
    let gates = 0;

    await runWhileWithParentVerify({
      agentName: 'agent-s',
      firstPass: async () => {
        first += 1;
        return {};
      },
      hooks: {
        emitFinish: () => {},
        persistStage: () => {},
        runGate: async () => {
          gates += 1;
          return gates === 1 ? failGate() : passGate();
        },
      },
      pipelineStageIndex: 3,
      rerun: async () => {
        rerun += 1;
        return {};
      },
      sessionId: 's',
      stage: parentStage,
      storage: storageFrom({ c: 1 }),
    });

    assert.equal(first, 1);
    assert.equal(rerun, 1);
    assert.equal(gates, 2);
  });

  it('rerun skips warmUp by default after verify autoRetry', async () => {
    const kinds: string[] = [];
    let gates = 0;

    const stage = compileStage({
      logic: 'c += 1;',
      updateContextKeys: ['c'],
      warmUp: 'c += 0;',
      verify: {
        autoRetry: true,
        defId: 'stage-verify',
        minScore: 0.75,
      },
      whileSetup: 'false',
    }, 12);

    const runner: TRunYahl = async (_yahl, options) => {
      kinds.push(String(options?.loopMeta?.kind ?? ''));
      return {
        storage: options?.useStorage?.() ?? storageFrom({}),
        usage: { bashCalls: 0, turns: 1 },
      };
    };

    const storage = storageFrom({ c: 0 });

    await runWhileWithParentVerify({
      agentName: 'agent-s',
      firstPass: () => handleWhile(stage, storage, runner, undefined, 12),
      hooks: {
        emitFinish: () => {},
        persistStage: () => {},
        runGate: async () => {
          gates += 1;
          return gates === 1 ? failGate() : passGate();
        },
      },
      pipelineStageIndex: 12,
      rerun: (systemAppend) => handleWhile(
        stage,
        storage,
        runner,
        undefined,
        12,
        undefined,
        {
          skipWarmUp: resolveVerifySkipWarmUp(stage.spec.verify),
          systemAppend,
        },
      ),
      sessionId: 's',
      stage,
      storage,
    });

    assert.deepEqual(kinds, ['warmup', 'while', 'while']);
  });

  it('rerun re-runs warmUp when skipWarmUp is false', async () => {
    const kinds: string[] = [];
    let gates = 0;

    const stage = compileStage({
      logic: 'c += 1;',
      updateContextKeys: ['c'],
      warmUp: 'c += 0;',
      verify: {
        autoRetry: true,
        defId: 'stage-verify',
        minScore: 0.75,
        skipWarmUp: false,
      },
      whileSetup: 'false',
    }, 12);

    const runner: TRunYahl = async (_yahl, options) => {
      kinds.push(String(options?.loopMeta?.kind ?? ''));
      return {
        storage: options?.useStorage?.() ?? storageFrom({}),
        usage: { bashCalls: 0, turns: 1 },
      };
    };

    const storage = storageFrom({ c: 0 });

    await runWhileWithParentVerify({
      agentName: 'agent-s',
      firstPass: () => handleWhile(stage, storage, runner, undefined, 12),
      hooks: {
        emitFinish: () => {},
        persistStage: () => {},
        runGate: async () => {
          gates += 1;
          return gates === 1 ? failGate() : passGate();
        },
      },
      pipelineStageIndex: 12,
      rerun: (systemAppend) => handleWhile(
        stage,
        storage,
        runner,
        undefined,
        12,
        undefined,
        {
          skipWarmUp: resolveVerifySkipWarmUp(stage.spec.verify),
          systemAppend,
        },
      ),
      sessionId: 's',
      stage,
      storage,
    });

    assert.deepEqual(kinds, ['warmup', 'while', 'warmup', 'while']);
  });
});
