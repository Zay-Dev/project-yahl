import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { ParsedStage } from '@/orchestrator/-utils/yahl/types';
import type { TLoopMeta } from '@/shared/transports/-types';

import { compileStage } from '@/orchestrator/-utils/yahl';

import {
  hasMoreLoopIterations,
  isLoopStageCheckpoint,
  resolveLoopStageIndex,
} from './pipeline-continuation';

const loopStage = compileStage({
  contextKeys: ['items'],
  logic: '(() => ({ item }))',
  loopSetup: 'for each item of [items]',
  updateContextKeys: ['items'],
}, 265);

const plainStage = compileStage({
  logic: '(() => ({}))',
}, 322);

const yahlStages: ParsedStage[] = [
  plainStage,
  plainStage,
  { ...loopStage, type: 'loop' },
  plainStage,
];

const loopMeta: TLoopMeta = {
  arraySnapshot: [1, 2, 3, 4, 5, 6],
  index: 2,
  indexName: 'item',
  value: 3,
};

describe('resolveLoopStageIndex', () => {
  it('matches loop parsedStageSnapshot by lines', () => {
    assert.equal(resolveLoopStageIndex({
      parsedStageSnapshot: {
        lines: loopStage.lines,
        sourceStartLine: 1,
        type: 'loop',
      },
    }, yahlStages), 2);
  });

  it('falls back to first loop stage in parsedStages', () => {
    assert.equal(resolveLoopStageIndex({}, yahlStages), 2);
  });
});

describe('hasMoreLoopIterations', () => {
  it('returns true when index is before the last snapshot item', () => {
    assert.equal(hasMoreLoopIterations(loopMeta), true);
  });

  it('returns false on the last snapshot item', () => {
    assert.equal(hasMoreLoopIterations({
      ...loopMeta,
      index: 5,
    }), false);
  });

  it('returns true for while and warmup checkpoints', () => {
    assert.equal(hasMoreLoopIterations({
      arraySnapshot: [],
      index: 0,
      kind: 'while',
      value: 0,
    }), true);
    assert.equal(hasMoreLoopIterations({
      arraySnapshot: [],
      index: 0,
      kind: 'warmup',
      value: null,
    }), true);
  });
});

describe('isLoopStageCheckpoint', () => {
  it('returns true when loopMeta is present and pipeline stage is a loop', () => {
    assert.equal(isLoopStageCheckpoint(loopMeta, yahlStages, 2), true);
  });

  it('returns false for plain stages without loopMeta', () => {
    assert.equal(isLoopStageCheckpoint(undefined, yahlStages, 2), false);
    assert.equal(isLoopStageCheckpoint(loopMeta, yahlStages, 0), false);
  });

  it('returns false for while stages without loopMeta', () => {
    const whileStage = compileStage({
      logic: 'c += 1;',
      whileSetup: 'true',
    }, 1);

    assert.equal(isLoopStageCheckpoint(undefined, [whileStage], 0), false);
  });

  it('returns true for while checkpoints on while stages', () => {
    const whileStage = compileStage({
      logic: 'c += 1;',
      whileSetup: 'true',
    }, 1);
    const stages: ParsedStage[] = [plainStage, whileStage];

    assert.equal(isLoopStageCheckpoint({
      arraySnapshot: [],
      index: 0,
      kind: 'while',
      value: 0,
    }, stages, 1), true);
    assert.equal(isLoopStageCheckpoint({
      arraySnapshot: [],
      index: 0,
      kind: 'warmup',
      value: null,
    }, stages, 1), true);
  });
});
