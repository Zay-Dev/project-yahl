import type { ParsedStage } from '@/orchestrator/-utils/yahl/types';
import type { TLoopMeta, TStorage } from '@/shared/transports/-types';

import { fetchSession, fetchStageDetail } from '@/orchestrator/-ask-user';
import { isStageFinished } from '@/shared/stage-status';
import { runVerifyGate } from '@/orchestrator/-verify';

import {
  isLoopStageCheckpoint,
  resolveLoopStageIndex,
  runPipelineContinuation,
} from './pipeline-continuation';

const withBaseSystemAppend = async (
  _sessionId: string,
  _taskId: string,
  baseAppend: string | undefined,
  extra?: string,
) => {
  if (baseAppend && extra) {
    return `${baseAppend}\n\n${extra}`;
  }

  if (baseAppend) {
    return baseAppend;
  }

  return extra;
};

const resumeVerifyWithProducedKeys = async (params: {
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

export const resumeVerifyFromPrepared = async (
  sessionId: string,
  prepared: {
    cursor: {
      resumeStage?: { requestId: string; stage: ParsedStage };
      stageIndex: number;
      verifyWasUnavailableWithProducedKeys?: boolean;
    };
    parsedStages: ParsedStage[];
    resultContextKey: string;
    storage: TStorage;
    systemAppend?: string;
  },
) => {
  const activeStage = prepared.cursor.resumeStage!.stage;
  const stageIndex = prepared.cursor.stageIndex;
  const requestId = prepared.cursor.resumeStage!.requestId;
  const yahlStages = prepared.parsedStages;
  const storage = prepared.storage;
  const baseSystemAppend = prepared.systemAppend;

  const session = await fetchSession(sessionId);

  if (prepared.cursor.verifyWasUnavailableWithProducedKeys) {
    const resultStorage = await resumeVerifyWithProducedKeys({
      activeStage,
      baseSystemAppend,
      requestId,
      session: { resultContextKey: prepared.resultContextKey, taskId: session.taskId },
      sessionId,
      stageIndex,
      storage,
      yahlStages,
    });

    return {
      resultContextKey: prepared.resultContextKey,
      storage: resultStorage,
    };
  }

  const loopStageIndex = resolveLoopStageIndex({}, yahlStages);
  const stageDetail = await fetchStageDetail(sessionId, requestId);
  const loopMeta = stageDetail.loopMeta as TLoopMeta | undefined;

  if (isLoopStageCheckpoint(loopMeta, yahlStages, stageIndex)) {
    const resultStorage = await runPipelineContinuation({
      loopStageIndex: stageIndex,
      position: {
        kind: 'resumeStageThenContinue',
        loopMeta,
        requestId,
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
      resultContextKey: prepared.resultContextKey,
      storage: resultStorage,
    };
  }

  const resultStorage = await runPipelineContinuation({
    loopStageIndex: loopStageIndex >= 0 ? loopStageIndex : null,
    position: {
      kind: 'fromStageIndex',
      requestId,
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
    resultContextKey: prepared.resultContextKey,
    storage: resultStorage,
  };
};
