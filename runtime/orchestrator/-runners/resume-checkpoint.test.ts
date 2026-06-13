import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { ParsedStage } from '@/orchestrator/-utils/yahl/types';
import type { YahlStage } from '@/shared/yahl-stage';

import { buildAskUserContinuation } from '@/orchestrator/-ask-user';
import { parsedStageFromSnapshot } from '@/orchestrator/-ask-user/parsed-stage-snapshot';
import { compileStage } from '@/orchestrator/-utils/yahl';

const yahlStages: ParsedStage[] = [
  { lines: '{\na = 1;\n}', sourceStartLine: 1, spec: { logic: 'a = 1;' }, type: 'plain' },
];

const buildResumedFromCheckpoint = (
  checkpoint: {
    parsedStageSnapshot?: {
      lines: string;
      sourceStartLine: number;
      type: 'loop' | 'plain';
    };
    stage: YahlStage;
    stageIndex?: number;
  },
  questionRef: string,
  answerValue: number | string,
) => {
  const stageBase = checkpoint.stage;
  const baseParsed = checkpoint.parsedStageSnapshot
    ? parsedStageFromSnapshot(stageBase, checkpoint.parsedStageSnapshot)
    : yahlStages[checkpoint.stageIndex!]!;

  const patchedStage = {
    ...stageBase,
    askUser: stageBase.askUser?.map((entry) => (
      entry.id === questionRef
        ? { ...entry, answer: answerValue }
        : entry
    )),
  };

  const continuation = buildAskUserContinuation(
    patchedStage.logic,
    questionRef,
    answerValue,
  );

  assert.ok(continuation);

  return compileStage(
    { ...patchedStage, logic: continuation.stageText },
    baseParsed.sourceStartLine,
  );
};

describe('resume checkpoint anchoring', () => {
  it('fork edited ask-user resume uses snapshot not parsedStages', () => {
    const editedStage = {
      askUser: [{ id: '1', question: 'pick' }],
      logic: 'c += /ask-user(1);\nc += 99;',
    };

    const resumed = buildResumedFromCheckpoint(
      {
        parsedStageSnapshot: {
          lines: '{\nc += /ask-user(1);\nc += 99;\n}',
          sourceStartLine: 1,
          type: 'plain',
        },
        stage: editedStage,
      },
      '1',
      3,
    );

    assert.match(resumed.spec.logic, /3/);
    assert.doesNotMatch(resumed.spec.logic, /ask-user/);
  });

  it('legacy non-fork resume falls back to stageIndex', () => {
    const resumed = buildResumedFromCheckpoint(
      {
        stage: {
          askUser: [{ id: '1', question: 'pick' }],
          logic: 'c += /ask-user(1);',
        },
        stageIndex: 0,
      },
      '1',
      2,
    );

    assert.match(resumed.spec.logic, /2/);
  });
});
