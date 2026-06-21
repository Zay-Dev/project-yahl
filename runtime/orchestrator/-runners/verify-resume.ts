import { runYahl } from '@/orchestrator/-agent';
import {
  applyVerifyRecoveryToStorage,
  buildVerifyRecoverySystemAppend,
  resolveActiveStageForVerifyRecovery,
  resolveEditedAnswerValue,
  stripProduceKeysFromStorage,
} from '@/orchestrator/-verify/resume-helpers';

import { loadCheckpointResumeContext } from './checkpoint-resume-load';

const _resolveResumeAction = (
  checkpoint: Awaited<ReturnType<typeof loadCheckpointResumeContext>>['checkpoint'],
) => {
  if (checkpoint.editedAnswerFreeText?.trim() || checkpoint.editedAnswerOptionIds?.length) {
    return 'edit_answer' as const;
  }

  if (
    checkpoint.resumeAction === 'edit_answer'
    || checkpoint.resumeAction === 'follow_up'
    || checkpoint.resumeAction === 'reask'
    || checkpoint.resumeAction === 'rerun'
  ) {
    return checkpoint.resumeAction;
  }

  return 'rerun' as const;
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
    ? resolveEditedAnswerValue({
      editedAnswerFreeText: checkpoint.editedAnswerFreeText,
      editedAnswerOptionIds: checkpoint.editedAnswerOptionIds,
    })
    : undefined;

  applyVerifyRecoveryToStorage({
    askUserRef,
    editedAnswerValue,
    feedback,
    resumeAction,
    storage,
  });

  const activeStage = resolveActiveStageForVerifyRecovery({
    askUserRef,
    checkpointStage: checkpoint.stage,
    editedAnswerValue,
    resumeAction,
    stageIndex,
    yahlStages,
  });

  stripProduceKeysFromStorage(storage, activeStage);

  const systemAppend = buildVerifyRecoverySystemAppend({
    feedback,
    resumeAction,
    score: checkpoint.score,
  });

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
