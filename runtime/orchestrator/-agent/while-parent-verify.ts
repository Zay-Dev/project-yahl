import { randomUUID } from 'crypto';

import type { TVerifyGateResult } from '@/orchestrator/-verify';
import type { ParsedStage } from '@/orchestrator/-utils/yahl/types';
import type { TLoopMeta, TStorage } from '@/shared/transports/-types';
import type { YahlStage } from '@/shared/yahl-stage';

import { filterStorageForStage } from '@/orchestrator/-context';
import { isVerifyRubricFailure, runVerifyGate } from '@/orchestrator/-verify';
import {
  applyVerifyRecoveryToStorage,
  buildVerifyRecoverySystemAppend,
  stripProduceKeysFromStorage,
  verifyAutoRetryMaxIterations,
} from '@/orchestrator/-verify/resume-helpers';

export const isPostLoopWhileResume = (loopMeta?: TLoopMeta) => !loopMeta;

type TWhileParentPersistEnvelope = {
  context: { context: Record<string, unknown>; types: Record<string, unknown> };
  parsedStageIndex: number;
  requestId: string;
  sourceStartLine: number;
  stage: YahlStage;
  temperature?: number;
};

export type TWhileParentVerifyHooks = {
  emitFinish?: (envelope: { contextAfter: TStorage; requestId: string }) => void;
  persistStage?: (envelope: TWhileParentPersistEnvelope) => void;
  runGate?: (params: {
    agentName: string;
    pipelineStageIndex: number;
    requestId: string;
    sessionId: string;
    stage: ParsedStage;
    storage: TStorage;
    shutdownOnFail?: boolean;
    throwOnFail?: boolean;
  }) => Promise<TVerifyGateResult>;
};

const serializeStorageSnapshot = (storage: TStorage) => ({
  context: Object.fromEntries(storage.context.entries()),
  types: Object.fromEntries(storage.types.entries()),
});

export const runWhileWithParentVerify = async (params: {
  agentName: string;
  firstPass: (systemAppend?: string) => Promise<{ gotoTargetStageIndex?: number }>;
  hooks?: TWhileParentVerifyHooks;
  pipelineStageIndex: number;
  rerun: (systemAppend?: string) => Promise<{ gotoTargetStageIndex?: number }>;
  sessionId: string;
  stage: ParsedStage;
  storage: TStorage;
  temperature?: number;
}): Promise<{ gotoTargetStageIndex?: number }> => {
  const autoRetry = params.stage.spec.verify?.autoRetry === true;
  const maxRetries = verifyAutoRetryMaxIterations();
  const runGate = params.hooks?.runGate ?? runVerifyGate;

  let attempt = 0;
  let pass = params.firstPass;
  let systemAppend: string | undefined;

  while (true) {
    const result = await pass(systemAppend);

    if (result.gotoTargetStageIndex !== undefined) {
      return result;
    }

    if (!params.stage.spec.verify) {
      return {};
    }

    const requestId = randomUUID();
    const filtered = filterStorageForStage(
      params.storage,
      params.stage.lines,
      params.stage,
    );
    const persistEnvelope: TWhileParentPersistEnvelope = {
      context: serializeStorageSnapshot(filtered),
      parsedStageIndex: params.pipelineStageIndex,
      requestId,
      sourceStartLine: params.stage.sourceStartLine,
      stage: params.stage.spec,
      ...(params.temperature === undefined ? {} : { temperature: params.temperature }),
    };

    if (params.hooks?.persistStage) {
      params.hooks.persistStage(persistEnvelope);
    } else {
      globalThis.sessionTracker?.createStage(params.sessionId, persistEnvelope);
    }

    await globalThis.sessionTracker?.flush?.();

    const verifyResult = await runGate({
      agentName: params.agentName,
      pipelineStageIndex: params.pipelineStageIndex,
      requestId,
      sessionId: params.sessionId,
      shutdownOnFail: !autoRetry || attempt >= maxRetries,
      stage: params.stage,
      storage: params.storage,
      throwOnFail: !autoRetry || attempt >= maxRetries,
    });

    if (verifyResult.pass) {
      const finishEnvelope = {
        contextAfter: params.storage,
        requestId,
      };

      if (params.hooks?.emitFinish) {
        params.hooks.emitFinish(finishEnvelope);
      } else {
        publisher.emitStageFinish(finishEnvelope);
      }

      await globalThis.sessionTracker?.flush?.();
      return {};
    }

    if (!autoRetry || attempt >= maxRetries || !isVerifyRubricFailure(verifyResult)) {
      return {};
    }

    attempt += 1;
    const resumeAction = verifyResult.resumeAction ?? 'rerun';

    applyVerifyRecoveryToStorage({
      askUserRef: verifyResult.askUserRef,
      failedChecks: verifyResult.failedChecks,
      feedback: verifyResult.feedback,
      resumeAction,
      storage: params.storage,
    });

    stripProduceKeysFromStorage(params.storage, params.stage);

    systemAppend = buildVerifyRecoverySystemAppend({
      failedChecks: verifyResult.failedChecks,
      feedback: verifyResult.feedback,
      produceContextKeys: params.stage.produceContextKeys ?? params.stage.spec.produceContextKeys,
      resumeAction,
      score: verifyResult.score,
      updateContextKeys: params.stage.updateContextKeys ?? params.stage.spec.updateContextKeys,
    });
    pass = params.rerun;
  }
};
