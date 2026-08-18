import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildStageLabels } from './stage-label';

const stage = (
  overrides: Partial<Parameters<typeof buildStageLabels>[0][number]> = {},
) => ({
  createdAt: '',
  lastModelDurationMs: 0,
  logicPreview: '',
  modelCallCount: 0,
  modelDurationMs: 0,
  requestId: 'r1',
  stageId: 's1',
  status: 'running' as const,
  domains: [],
  tokenTotals: null,
  toolCallCount: 0,
  updatedAt: '',
  ...overrides,
});

describe('buildStageLabels', () => {
  it('labels types preamble without incrementing task stage number', () => {
    const labels = buildStageLabels([
      stage({ isTypesPreamble: true, logicPreview: 'type T = { a: string };' }),
      stage({ logicPreview: 'const x = 1;' }),
      stage({ logicPreview: 'const y = 2;' }),
    ]);

    assert.deepEqual(labels, ['Types', '#1', '#2']);
  });

  it('keeps sequential numbering when no types preamble', () => {
    const labels = buildStageLabels([
      stage({ logicPreview: 'a' }),
      stage({ logicPreview: 'b' }),
    ]);

    assert.deepEqual(labels, ['#1', '#2']);
  });
});
