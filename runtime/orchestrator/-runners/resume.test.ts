import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { ParsedStage } from '@/orchestrator/-utils/yahl/types';

import {
  buildResumePipelineStages,
  resolveForkSuffixFromSetupIndex,
  resolveResumeStartIndex,
} from './resume';
import { isLoopStageCheckpoint } from './loop-resume';

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

describe('resolveForkSuffixFromSetupIndex', () => {
  it('continues fork suffix from the setup after the anchor', () => {
    assert.equal(resolveForkSuffixFromSetupIndex(0), 1);
    assert.equal(resolveForkSuffixFromSetupIndex(2), 3);
  });

  it('defaults missing forkSetupIndex to anchor setup 0', () => {
    assert.equal(resolveForkSuffixFromSetupIndex(undefined), 1);
  });
});
