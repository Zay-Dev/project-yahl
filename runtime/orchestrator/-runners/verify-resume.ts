import type { ParsedStage } from '@/orchestrator/-utils/yahl/types';
import type { YahlStage } from '@/shared/yahl-stage';

import { runYahl } from '@/orchestrator/-agent';
import {
  applyAskUserAnswerToStage,
  resetAskUserStageForRerun,
  stripAskUserAnswersFromContext,
  toAskUserAnswerValue,
} from '@/orchestrator/-ask-user';
import { compileStage } from '@/orchestrator/-utils/yahl';
import { resolveFreshStageForVerifyResume } from '@/orchestrator/-verify/stage-snapshot';

import { buildResumedStage } from './resume';
import { loadCheckpointResumeContext } from './checkpoint-resume-load';

const _resolveResumeAction = (
  checkpoint: Awaited<ReturnType<typeof loadCheckpointResumeContext>>['checkpoint'],
) => {
  if (checkpoint.editedAnswerFreeText?.trim() || checkpoint.editedAnswerOptionIds?.length) {
    return 'edit_answer' as const;
  }

  if (
    checkpoint.resumeAction === 'edit_answer'
    || checkpoint.resumeAction === 'reask'
    || checkpoint.resumeAction === 'rerun'
  ) {
    return checkpoint.resumeAction;
  }

  return 'rerun' as const;
};

const _resolveEditedAnswerValue = (
  checkpoint: Awaited<ReturnType<typeof loadCheckpointResumeContext>>['checkpoint'],
) => {
  if (checkpoint.editedAnswerFreeText?.trim()) {
    return checkpoint.editedAnswerFreeText.trim();
  }

  return toAskUserAnswerValue(checkpoint.editedAnswerOptionIds?.[0]);
};

const _stripProduceKeys = (
  storage: Awaited<ReturnType<typeof loadCheckpointResumeContext>>['storage'],
  stage: ParsedStage,
) => {
  for (const key of stage.produceContextKeys ?? stage.spec.produceContextKeys ?? []) {
    storage.context.delete(key);
  }
};

const _buildVerifyResumeSystemAppend = (
  checkpoint: Awaited<ReturnType<typeof loadCheckpointResumeContext>>['checkpoint'],
  resumeAction: 'edit_answer' | 'reask' | 'rerun',
) => {
  const parts = [
    `Stage verification failed (score ${checkpoint.score}).`,
    String(checkpoint.feedback ?? ''),
  ];

  if (resumeAction === 'rerun') {
    parts.push(
      'Re-run this stage and fix the output. Use set_context to write every produceContextKeys value before finishing.',
    );
  }

  if (resumeAction === 'reask') {
    parts.push(
      'Prior ask-user answers were cleared. Call ask_user again for the required question before producing output.',
    );
  }

  if (resumeAction === 'edit_answer') {
    parts.push(
      'The user corrected their prior answer. Re-run stage logic using the updated answer already in context.',
    );
  }

  return parts.filter(Boolean).join('\n\n');
};

const _resolveActiveStage = (
  checkpoint: Awaited<ReturnType<typeof loadCheckpointResumeContext>>['checkpoint'],
  yahlStages: ParsedStage[],
  stageIndex: number,
  resumeAction: 'edit_answer' | 'reask' | 'rerun',
  answerValue?: number | string,
): ParsedStage => {
  const freshStage = resolveFreshStageForVerifyResume(
    stageIndex,
    yahlStages,
    checkpoint.stage as YahlStage,
  );

  if (resumeAction === 'edit_answer' && answerValue != null) {
    const askUserRef = String(checkpoint.askUserRef ?? '').trim();
    const baseStage = freshStage ?? {
      ...yahlStages[stageIndex]!,
      spec: checkpoint.stage as YahlStage,
    };
    const patchedStage = applyAskUserAnswerToStage(
      baseStage.spec,
      askUserRef,
      answerValue,
    );

    return buildResumedStage(baseStage, patchedStage, askUserRef, answerValue);
  }

  if (resumeAction === 'reask' && freshStage) {
    const resetSpec = resetAskUserStageForRerun(freshStage.spec);

    return compileStage(resetSpec, freshStage.sourceStartLine);
  }

  if (freshStage) {
    return freshStage;
  }

  return yahlStages[stageIndex]!;
};

const _applyEditedAnswerToStorage = (
  storage: Awaited<ReturnType<typeof loadCheckpointResumeContext>>['storage'],
  askUserRef: string,
  answerValue: number | string,
) => {
  const answerKey = `ask_user_${askUserRef}_answer`;

  storage.context.set(answerKey, answerValue);
  storage.context.set('ask_user_last_answer', answerValue);
};

export const runVerifyResume = async (sessionId: string, verifyId: string) => {
  const {
    checkpoint,
    session,
    stageIndex,
    storage,
    yahlStages,
  } = await loadCheckpointResumeContext(sessionId, verifyId);

  const resumeAction = _resolveResumeAction(checkpoint);
  const feedback = String(checkpoint.feedback ?? '');
  const requestId = String(checkpoint.requestId ?? '');
  const askUserRef = String(checkpoint.askUserRef ?? '').trim();
  const editedAnswerValue = resumeAction === 'edit_answer'
    ? _resolveEditedAnswerValue(checkpoint)
    : undefined;

  if (resumeAction === 'reask') {
    const stripped = stripAskUserAnswersFromContext({
      context: Object.fromEntries(storage.context.entries()),
      types: Object.fromEntries(storage.types.entries()),
    }) as { context?: Record<string, unknown>; types?: Record<string, unknown> };

    if (stripped.context) {
      storage.context.clear();
      Object.entries(stripped.context).forEach(([key, value]) => {
        storage.context.set(key, value);
      });
    }
  }

  storage.context.set('verify_feedback', feedback);

  const activeStage = _resolveActiveStage(
    checkpoint,
    yahlStages,
    stageIndex,
    resumeAction,
    editedAnswerValue,
  );

  _stripProduceKeys(storage, activeStage);

  if (resumeAction === 'edit_answer' && editedAnswerValue != null && askUserRef) {
    _applyEditedAnswerToStorage(storage, askUserRef, editedAnswerValue);
  }

  const systemAppend = _buildVerifyResumeSystemAppend(checkpoint, resumeAction);

  const { storage: resultStorage } = await runYahl('', {
    resumeStage: {
      requestId,
      stage: activeStage,
    },
    stages: yahlStages,
    startFromStageIndex: stageIndex,
    systemAppend,
    useStorage: () => storage,
  });

  return {
    resultContextKey: session.resultContextKey ?? 'result',
    storage: resultStorage,
  };
};
