import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { ParsedStage } from '@/orchestrator/-utils/yahl/types';

import {
  parsedStagesMatchSlot,
  realignActiveStageToBound,
  resolveActiveStageForVerifyRecoveryBound,
  shouldRotateRequestIdForBoundStage,
} from '@/orchestrator/-verify/resume-helpers';

const makeStage = (
  sourceStartLine: number,
  produceContextKeys: string[],
  logic: string,
): ParsedStage => ({
  lines: `{ logic: ${logic} }`,
  produceContextKeys,
  sourceStartLine,
  spec: { logic, produceContextKeys },
  type: 'plain',
});

describe('parsedStagesMatchSlot', () => {
  it('matches stages with the same sourceStartLine', () => {
    const goals = makeStage(42, ['goals_profile'], 'goals logic');
    const goalsCopy = makeStage(42, ['goals_profile'], 'other logic');

    assert.equal(parsedStagesMatchSlot(goals, goalsCopy), true);
  });

  it('rejects stages with different sourceStartLine', () => {
    const goals = makeStage(42, ['goals_profile'], 'goals logic');
    const communication = makeStage(88, ['communication_profile'], 'communication logic');

    assert.equal(parsedStagesMatchSlot(goals, communication), false);
  });
});

describe('realignActiveStageToBound', () => {
  it('keeps recovered stage when it matches the bound slot', () => {
    const bound = makeStage(42, ['goals_profile'], 'goals logic');
    const recovered = makeStage(42, ['goals_profile'], 'goals logic refreshed');

    const aligned = realignActiveStageToBound(bound, recovered);

    assert.equal(aligned, recovered);
  });

  it('rejects recovered stage from a different YAML slot', () => {
    const bound = makeStage(42, ['goals_profile'], 'goals logic');
    const wrongSlot = makeStage(88, ['communication_profile'], 'communication logic');

    const aligned = realignActiveStageToBound(bound, wrongSlot);

    assert.equal(aligned, bound);
    assert.deepEqual(aligned.produceContextKeys, ['goals_profile']);
  });
});

describe('shouldRotateRequestIdForBoundStage', () => {
  it('requires a new requestId when the stage doc was created for the wrong slot', () => {
    assert.equal(shouldRotateRequestIdForBoundStage(88, 42), true);
  });

  it('keeps requestId when no stage doc exists yet', () => {
    assert.equal(shouldRotateRequestIdForBoundStage(undefined, 42), false);
  });

  it('keeps requestId when stage doc matches the bound slot', () => {
    assert.equal(shouldRotateRequestIdForBoundStage(42, 42), false);
  });
});

describe('resolveActiveStageForVerifyRecoveryBound', () => {
  it('does not swap goals slot to communication on verify auto-retry', () => {
    const yahlStages = [
      makeStage(1, [], 'types'),
      makeStage(10, ['identity_profile'], 'identity'),
      makeStage(42, ['goals_profile'], 'goals logic'),
      makeStage(55, ['preferences_profile'], 'preferences'),
      makeStage(88, ['communication_profile'], 'communication logic'),
    ];

    const boundStage = yahlStages[2]!;
    const wrongCheckpoint = yahlStages[4]!.spec;

    const recovered = resolveActiveStageForVerifyRecoveryBound({
      boundParsedStageIndex: 2,
      boundStage,
      checkpointStage: wrongCheckpoint,
      resumeAction: 'rerun',
      yahlStages,
    });

    assert.equal(recovered.sourceStartLine, 42);
    assert.deepEqual(recovered.produceContextKeys, ['goals_profile']);
    assert.match(recovered.spec.logic, /goals logic/);
  });

  it('recovers from sliced resume pipeline using bound index, not absolute pipeline index', () => {
    const resumedStage = makeStage(42, ['goals_profile'], 'goals logic resumed');
    const yahlStages = [
      makeStage(1, [], 'types'),
      makeStage(10, ['identity_profile'], 'identity'),
      makeStage(42, ['goals_profile'], 'goals logic'),
      makeStage(55, ['preferences_profile'], 'preferences'),
    ];
    const pipelineStages = [resumedStage, yahlStages[3]!];

    const recovered = resolveActiveStageForVerifyRecoveryBound({
      boundParsedStageIndex: 0,
      boundStage: resumedStage,
      checkpointStage: resumedStage.spec,
      resumeAction: 'follow_up',
      yahlStages: pipelineStages,
    });

    assert.equal(recovered.sourceStartLine, 42);
    assert.match(recovered.spec.logic, /goals logic resumed/);
  });

  it('allows fresh YAML reload for the bound slot on rerun', () => {
    const yahlStages = [
      makeStage(42, ['goals_profile'], 'const answer = /ask-user(goals);'),
    ];

    const boundStage = yahlStages[0]!;

    const recovered = resolveActiveStageForVerifyRecoveryBound({
      boundParsedStageIndex: 0,
      boundStage,
      checkpointStage: {
        askUser: [{ answer: 'stale', id: 'goals', question: 'goals?' }],
        logic: 'const answer = "stale";',
        produceContextKeys: ['goals_profile'],
      },
      resumeAction: 'rerun',
      yahlStages,
    });

    assert.equal(recovered.sourceStartLine, 42);
    assert.match(recovered.spec.logic, /\/ask-user\(goals\)/);
    assert.equal(recovered.spec.askUser?.[0]?.answer, undefined);
  });
});
