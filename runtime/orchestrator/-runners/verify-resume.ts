import type { ParsedStage } from '@/orchestrator/-utils/yahl/types';
import type { TStorage } from '@/shared/transports/-types';

import { runYahl } from '@/orchestrator/-agent';
import { fetchStageDetail } from '@/orchestrator/-ask-user';
import { mergeTaskSystemAppend } from '@/orchestrator/-utils/workspace-paths';
import { isStageFinished } from '@/shared/stage-status';
import { runVerifyGate } from '@/orchestrator/-verify';
import { syncKnowledgePathsPersisted } from '@/orchestrator/-verify/knowledge-paths-sync';
import {
  applyVerifyRecoveryToStorage,
  buildVerifyRecoverySystemAppend,
  resolveActiveStageForVerifyRecovery,
  resolveEditedAnswerValue,
  stripProduceKeysFromStorage,
} from '@/orchestrator/-verify/resume-helpers';

import { loadCheckpointResumeContext } from './checkpoint-resume-load';

const hasProducedKeys = (stage: ParsedStage, resultStorage: TStorage) => {
  const keys = stage.spec.produceContextKeys ?? [];

  if (!keys.length) {
    return false;
  }

  return keys.every((key) => {
    const value = resultStorage.context.get(key);

    return value !== undefined && value !== null;
  });
};

const runVerifyOnlyUnavailableResume = async (params: {
  activeStage: ParsedStage;
  requestId: string;
  session: { resultContextKey?: string; taskId?: string };
  sessionId: string;
  stageIndex: number;
  storage: TStorage;
  yahlStages: ParsedStage[];
}) => {
  const agentName = `agent-${params.sessionId}`;

  await syncKnowledgePathsPersisted(params.storage);

  const stageDetail = await fetchStageDetail(params.sessionId, params.requestId);
  const verifyAlreadyPassed = isStageFinished(stageDetail);

  if (!verifyAlreadyPassed) {
    await runVerifyGate({
      agentName,
      pipelineStageIndex: params.stageIndex,
      requestId: params.requestId,
      sessionId: params.sessionId,
      stage: params.activeStage,
      storage: params.storage,
      shutdownOnFail: true,
      throwOnFail: true,
    });

    publisher.emitStageFinish({
      contextAfter: params.storage,
      requestId: params.requestId,
    });
    await globalThis.sessionTracker?.flush?.();
  }

  if (params.stageIndex + 1 >= params.yahlStages.length) {
    return params.storage;
  }

  const systemAppend = await mergeTaskSystemAppend(params.sessionId, params.session.taskId);

  const { storage: resultStorage } = await runYahl('', {
    stages: params.yahlStages,
    startFromStageIndex: params.stageIndex + 1,
    systemAppend,
    useStorage: () => params.storage,
  });

  return resultStorage;
};

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
    activeStage,
    checkpoint,
    session,
    stageIndex,
    storage,
    yahlStages,
  } = await loadCheckpointResumeContext(sessionId, verifyId);

  if (checkpoint.unavailable) {
    if (hasProducedKeys(activeStage, storage)) {
      const resultStorage = await runVerifyOnlyUnavailableResume({
        activeStage,
        requestId: String(checkpoint.requestId),
        session,
        sessionId,
        stageIndex,
        storage,
        yahlStages,
      });

      return {
        resultContextKey: session.resultContextKey ?? 'result',
        storage: resultStorage,
      };
    }

    const { storage: resultStorage } = await runYahl('', {
      resumeStage: {
        requestId: String(checkpoint.requestId),
        stage: activeStage,
      },
      stages: yahlStages,
      startFromStageIndex: stageIndex,
      useStorage: () => storage,
    });

    return {
      resultContextKey: session.resultContextKey ?? 'result',
      storage: resultStorage,
    };
  }

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

  const recoveryStage = resolveActiveStageForVerifyRecovery({
    askUserRef,
    checkpointStage: checkpoint.stage,
    editedAnswerValue,
    resumeAction,
    stageIndex,
    yahlStages,
  });

  stripProduceKeysFromStorage(storage, recoveryStage);

  const systemAppend = await mergeTaskSystemAppend(
    sessionId,
    session.taskId,
    buildVerifyRecoverySystemAppend({
      feedback,
      produceContextKeys: recoveryStage.produceContextKeys ?? recoveryStage.spec.produceContextKeys,
      resumeAction,
      score: checkpoint.score,
      updateContextKeys: recoveryStage.updateContextKeys ?? recoveryStage.spec.updateContextKeys,
    }),
  );

  const { storage: resultStorage } = await runYahl('', {
    resumeStage: {
      requestId,
      stage: recoveryStage,
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
