import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { ParsedStage } from '@/orchestrator/-utils/yahl/types';

import {
  buildResumePipelineStages,
  resolveResumeStartIndex,
} from './resume';
import { isLoopStageCheckpoint, resolveLoopStageIndex } from './pipeline-continuation';

const yahlStages: ParsedStage[] = [
  { lines: 'a', sourceStartLine: 1, spec: { logic: 'a' }, type: 'plain' },
  { lines: 'b', sourceStartLine: 2, spec: { logic: 'b' }, type: 'plain' },
  { lines: 'c', sourceStartLine: 3, spec: { logic: 'c' }, type: 'plain' },
  { lines: 'd', sourceStartLine: 4, spec: { logic: 'd' }, type: 'plain' },
  { lines: 'e', sourceStartLine: 5, spec: { logic: 'e' }, type: 'plain' },
];

describe('buildResumePipelineStages', () => {
  it('prepends resumed stage and keeps suffix stages', () => {
    const resumedStage: ParsedStage = {
      lines: 'd-resumed',
      sourceStartLine: 4,
      spec: { logic: 'd-resumed' },
      type: 'plain',
    };

    const pipelineStages = buildResumePipelineStages(3, yahlStages, resumedStage);

    assert.equal(pipelineStages.length, 2);
    assert.equal(pipelineStages[0]?.lines, 'd-resumed');
    assert.equal(pipelineStages[1]?.lines, 'e');
  });
});

describe('loop stage resume detection', () => {
  it('identifies loop checkpoints at the loop pipeline index', () => {
    const loopMeta = {
      arraySnapshot: [1, 2, 3, 4, 5, 6],
      index: 2,
      indexName: 'src',
      value: 3,
    };

    const stages: ParsedStage[] = [
      { lines: 'a', sourceStartLine: 1, spec: { logic: 'a' }, type: 'plain' },
      {
        lines: 'for each src of [study_plan.sources]',
        sourceStartLine: 2,
        spec: { logic: 'body', loopSetup: 'for each src of [study_plan.sources]' },
        type: 'loop',
      },
      { lines: 'facts', sourceStartLine: 3, spec: { logic: 'facts' }, type: 'plain' },
    ];

    assert.equal(isLoopStageCheckpoint(loopMeta, stages, 1), true);
    assert.equal(isLoopStageCheckpoint(loopMeta, stages, 0), false);
  });
});

describe('resolveResumeStartIndex', () => {
  it('prefers checkpoint stageIndex', () => {
    assert.equal(resolveResumeStartIndex({ stageIndex: 2 }, yahlStages), 2);
  });

  it('falls back to parsedStageSnapshot match', () => {
    assert.equal(resolveResumeStartIndex({
      parsedStageSnapshot: {
        lines: 'd',
        sourceStartLine: 4,
        type: 'plain',
      },
    }, yahlStages), 3);
  });
});

describe('resolveLoopStageIndex for fork checkpoints', () => {
  it('resolves loop stage when snapshot sourceStartLine differs from parsedStages', () => {
    const loopMeta = {
      arraySnapshot: [1, 2, 3, 4, 5, 6],
      index: 2,
      indexName: 'src',
      value: 3,
    };

    const stages: ParsedStage[] = [
      { lines: 'a', sourceStartLine: 10, spec: { logic: 'a' }, type: 'plain' },
      {
        lines: 'for each src of [study_plan.sources]',
        sourceStartLine: 265,
        spec: { logic: 'body', loopSetup: 'for each src of [study_plan.sources]' },
        type: 'loop',
      },
      { lines: 'facts', sourceStartLine: 322, spec: { logic: 'facts' }, type: 'plain' },
    ];

    assert.equal(resolveLoopStageIndex({
      parsedStageSnapshot: {
        lines: 'for each src of [study_plan.sources]',
        sourceStartLine: 1,
        type: 'loop',
      },
    }, stages), 1);
    assert.equal(isLoopStageCheckpoint(loopMeta, stages, 1), true);
  });
});
