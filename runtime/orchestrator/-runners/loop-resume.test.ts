import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { ParsedStage } from '@/orchestrator/-utils/yahl/types';
import type { TLoopMeta } from '@/shared/transports/-types';

import { compileStage } from '@/orchestrator/-utils/yahl';

import { isLoopStageCheckpoint } from './loop-resume';

const loopStage = compileStage({
  contextKeys: ['items'],
  logic: '(() => ({ item }))',
  loopSetup: 'for each item of [items]',
  updateContextKeys: ['items'],
}, 1);

const plainStage = compileStage({
  logic: '(() => ({}))',
}, 2);

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

describe('isLoopStageCheckpoint', () => {
  it('returns true when loopMeta is present and pipeline stage is a loop', () => {
    assert.equal(isLoopStageCheckpoint(loopMeta, yahlStages, 2), true);
  });

  it('returns false for plain stages without loopMeta', () => {
    assert.equal(isLoopStageCheckpoint(undefined, yahlStages, 2), false);
    assert.equal(isLoopStageCheckpoint(loopMeta, yahlStages, 0), false);
  });
});
