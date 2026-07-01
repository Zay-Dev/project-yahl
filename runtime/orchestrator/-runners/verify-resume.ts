import type { ParsedStage } from '@/orchestrator/-utils/yahl/types';
import type { TLoopMeta, TStorage } from '@/shared/transports/-types';

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
import {
  isLoopStageCheckpoint,
  resolveLoopStageIndex,
  runPipelineContinuation,
} from './pipeline-continuation';

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

const withBaseSystemAppend = async (
  sessionId: string,
  taskId: string,
  baseAppend: string | undefined,
  extra?: string,
) => {
  if (baseAppend && extra) {
    return `${baseAppend}\n\n${extra}`;
  }

  if (baseAppend) {
    return baseAppend;
  }

  return mergeTaskSystemAppend(sessionId, taskId, extra);
};

const runVerifyOnlyUnavailableResume = async (params: {
  activeStage: ParsedStage;
  baseSystemAppend?: string;
  requestId: string;
  session: { resultContextKey?: string; taskId: string };
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

  const systemAppend = await withBaseSystemAppend(
    params.sessionId,
    params.session.taskId,
    params.baseSystemAppend,
  );
  const loopMeta = stageDetail.loopMeta as TLoopMeta | undefined;
  const loopStageIndex = resolveLoopStageIndex({}, params.yahlStages);

  if (isLoopStageCheckpoint(loopMeta, params.yahlStages, params.stageIndex)) {
    await runPipelineContinuation({
      loopStageIndex: params.stageIndex,
      position: {
        kind: 'loopAfterIteration',
        loopMeta: loopMeta!,
        loopStageIndex: params.stageIndex,
      },
      storage: params.storage,
      suffix: {
        kind: 'parsedStages',
        fromStageIndex: params.stageIndex + 1,
      },
      systemAppend,
      yahlStages: params.yahlStages,
    });

    return params.storage;
  }

  const resultStorage = await runPipelineContinuation({
    loopStageIndex: loopStageIndex >= 0 ? loopStageIndex : null,
    position: {
      kind: 'fromStageIndex',
      stageIndex: params.stageIndex + 1,
    },
    storage: params.storage,
    suffix: {
      kind: 'parsedStages',
      fromStageIndex: params.stageIndex + 1,
    },
    systemAppend,
    yahlStages: params.yahlStages,
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

export const runVerifyResume = async (
  sessionId: string,
  verifyId: string,
  options?: { systemAppend?: string },
) => {
  const baseSystemAppend = options?.systemAppend;
  const {
    activeStage,
    checkpoint,
    session,
    stageIndex,
    storage,
    yahlStages,
  } = await loadCheckpointResumeContext(sessionId, verifyId);

  const loopStageIndex = resolveLoopStageIndex({}, yahlStages);

  if (checkpoint.unavailable) {
    if (hasProducedKeys(activeStage, storage)) {
      const resultStorage = await runVerifyOnlyUnavailableResume({
        activeStage,
        baseSystemAppend,
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

    const stageDetail = await fetchStageDetail(sessionId, String(checkpoint.requestId));
    const loopMeta = stageDetail.loopMeta as TLoopMeta | undefined;

    if (isLoopStageCheckpoint(loopMeta, yahlStages, stageIndex)) {
      const resultStorage = await runPipelineContinuation({
        loopStageIndex: stageIndex,
        position: {
          kind: 'resumeStageThenContinue',
          loopMeta,
          requestId: String(checkpoint.requestId),
          resumedStage: activeStage,
          stageIndex,
        },
        storage,
        suffix: {
          kind: 'parsedStages',
          fromStageIndex: stageIndex + 1,
        },
        systemAppend: await withBaseSystemAppend(sessionId, session.taskId, baseSystemAppend),
        yahlStages,
      });

      return {
        resultContextKey: session.resultContextKey ?? 'result',
        storage: resultStorage,
      };
    }

    const resultStorage = await runPipelineContinuation({
      loopStageIndex: loopStageIndex >= 0 ? loopStageIndex : null,
      position: {
        kind: 'fromStageIndex',
        requestId: String(checkpoint.requestId),
        resumedStage: activeStage,
        stageIndex,
      },
      storage,
      suffix: {
        kind: 'parsedStages',
        fromStageIndex: stageIndex,
      },
      systemAppend: await withBaseSystemAppend(sessionId, session.taskId, baseSystemAppend),
      yahlStages,
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

  const systemAppend = await withBaseSystemAppend(
    sessionId,
    session.taskId,
    baseSystemAppend,
    buildVerifyRecoverySystemAppend({
      feedback,
      produceContextKeys: recoveryStage.produceContextKeys ?? recoveryStage.spec.produceContextKeys,
      resumeAction,
      score: checkpoint.score,
      updateContextKeys: recoveryStage.updateContextKeys ?? recoveryStage.spec.updateContextKeys,
    }),
  );

  const stageDetail = await fetchStageDetail(sessionId, requestId);
  const loopMeta = stageDetail.loopMeta as TLoopMeta | undefined;

  const resultStorage = await runPipelineContinuation({
    loopStageIndex: loopStageIndex >= 0 ? loopStageIndex : null,
    position: {
      kind: 'resumeStageThenContinue',
      loopMeta,
      requestId,
      resumedStage: recoveryStage,
      stageIndex,
    },
    storage,
    suffix: {
      kind: 'parsedStages',
      fromStageIndex: stageIndex + 1,
    },
    systemAppend,
    yahlStages,
  });

  return {
    resultContextKey: session.resultContextKey ?? 'result',
    storage: resultStorage,
  };
};
