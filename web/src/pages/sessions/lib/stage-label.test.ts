import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildStageLabels, loopSetupHint } from './stage-label';

const stage = (
  overrides: Partial<Parameters<typeof buildStageLabels>[0][number]> = {},
) => ({
  createdAt: '',
  byModel: [],
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

  it('groups warmUp and while rows by parsedStageIndex', () => {
    const labels = buildStageLabels([
      stage({ logicPreview: 'init' }),
      stage({
        logicPreview: 'warm',
        loopIndex: 0,
        loopKind: 'warmup',
        parsedStageIndex: 12,
      }),
      stage({
        logicPreview: 'poll',
        loopIndex: 0,
        loopKind: 'while',
        parsedStageIndex: 12,
      }),
      stage({
        logicPreview: 'poll',
        loopIndex: 1,
        loopKind: 'while',
        parsedStageIndex: 12,
      }),
      stage({
        logicPreview: 'verify',
        parsedStageIndex: 12,
        whileSetup: 'context.context.c < 1',
      }),
      stage({ logicPreview: 'assemble' }),
    ]);

    assert.deepEqual(labels, ['#1', '#2.warmUp', '#2.0', '#2.1', '#2.verify', '#3']);
  });

  it('keeps for-loop labels as #n.index grouped by parsedStageIndex', () => {
    const labels = buildStageLabels([
      stage({
        logicPreview: 'c += i',
        loopIndex: 0,
        loopKind: 'for',
        parsedStageIndex: 2,
      }),
      stage({
        logicPreview: 'c += i',
        loopIndex: 1,
        loopKind: 'for',
        parsedStageIndex: 2,
      }),
    ]);

    assert.deepEqual(labels, ['#1.0', '#1.1']);
  });

  it('appends nested leaf under while labels', () => {
    const labels = buildStageLabels([
      stage({
        agentMeta: {
          isMainThread: false,
          nestedPath: 'monitor/goto',
          parentRequestId: 'p',
        },
        logicPreview: 'goto',
        loopIndex: 0,
        loopKind: 'while',
        parsedStageIndex: 10,
      }),
    ]);

    assert.deepEqual(labels, ['#1.0 › goto']);
  });
});

describe('loopSetupHint', () => {
  it('shows whileSetup condition instead of the object', () => {
    const stages = [
      stage({
        logicPreview: 'poll',
        loopIndex: 0,
        loopKind: 'while',
        parsedStageIndex: 12,
        whileSetup: {
          condition: 'context.context.c < 1',
          doAtLeast: 2,
        },
      }),
    ];

    assert.equal(loopSetupHint(stages, 0), 'context.context.c < 1');
  });
});
