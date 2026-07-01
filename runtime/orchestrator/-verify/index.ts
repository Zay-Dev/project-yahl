import type { TStorage } from '@/shared/transports/-types';
import type { ParsedStage } from '@/orchestrator/-utils/yahl/types';

import { shutdownAgent } from '@/orchestrator/-docker';

import { VerifyFailedError, VerifyUnavailableError } from './errors';
import { syncKnowledgePathsPersisted } from './knowledge-paths-sync';
import { postVerifyCheckpoint, postVerifyPass, postVerifyStart } from './session-api';
import { resolveVerifyResumeEnabled, toVerifyStageSnapshot } from './stage-snapshot';
import { toParsedStageSnapshot } from '@/orchestrator/-ask-user/parsed-stage-snapshot';

export type TVerifyGateResult = {
  askUserRef?: string;
  feedback: string;
  pass: true;
} | {
  askUserRef?: string;
  feedback: string;
  pass: false;
  resumeAction?: 'edit_answer' | 'follow_up' | 'reask' | 'rerun';
  score: number;
  verifyId: string;
};

export type TVerifyRubricFailure = Extract<TVerifyGateResult, { verifyId: string }>;

export const isVerifyRubricFailure = (
  result: TVerifyGateResult,
): result is TVerifyRubricFailure =>
  !result.pass && 'verifyId' in result;

const VERIFY_UNAVAILABLE_RETRY_MS = 1_000;

const sleep = (ms: number) => new Promise<void>((resolve) => {
  setTimeout(resolve, ms);
});

const _serializeStorage = (storage: TStorage) => ({
  context: Object.fromEntries(storage.context.entries()),
  types: Object.fromEntries(storage.types.entries()),
});

const _serializeContextSnapshot = (storage: TStorage) => ({
  context: Object.fromEntries(storage.context.entries()),
  stage: {},
  types: Object.fromEntries(storage.types.entries()),
});

export type TVerifyFastForward = {
  feedback: string;
  score: number;
};

export const runVerifyGate = async (params: {
  agentName: string;
  pipelineStageIndex: number;
  requestId: string;
  sessionId: string;
  stage: ParsedStage;
  storage: TStorage;
  shutdownOnFail?: boolean;
  throwOnFail?: boolean;
  verifyFastForward?: TVerifyFastForward;
}): Promise<TVerifyGateResult> => {
  const { stage } = params;
  const spec = stage.spec;

  if (spec.verify !== true) {
    return { feedback: '', pass: true };
  }

  const startedAt = Date.now();

  console.log(
    `[agent] verify start sessionId=${params.sessionId} requestId=${params.requestId} stageIndex=${params.pipelineStageIndex}`,
  );

  await syncKnowledgePathsPersisted(params.storage);

  if (params.verifyFastForward) {
    await globalThis.sessionTracker?.flush?.();

    await postVerifyPass(params.sessionId, params.requestId, {
      feedback: params.verifyFastForward.feedback,
      score: params.verifyFastForward.score,
    });

    await globalThis.sessionTracker?.flush?.();

    console.log(
      `[agent] verify fast-forward pass=true score=${params.verifyFastForward.score} durationMs=${Date.now() - startedAt}`,
    );

    return { feedback: params.verifyFastForward.feedback, pass: true };
  }

  await postVerifyStart(params.sessionId, params.requestId);

  const { callWorkerVerify } = await import('@/shared/worker-client');

  const verifyBody = {
    contextSnapshot: _serializeContextSnapshot(params.storage),
    minScore: spec.verifyMinScore,
    requestId: params.requestId,
    rubric: spec.verifyRubric,
    sessionId: params.sessionId,
    stageIndex: params.pipelineStageIndex,
    stageSnapshot: toVerifyStageSnapshot(spec),
    stageVersion: spec.version,
    verifyResume: resolveVerifyResumeEnabled(spec),
  };

  let result = await callWorkerVerify(verifyBody);

  if (!result.pass && result.unavailable) {
    await sleep(VERIFY_UNAVAILABLE_RETRY_MS);
    result = await callWorkerVerify(verifyBody);
  }

  if (result.pass) {
    await globalThis.sessionTracker?.flush?.();

    await postVerifyPass(params.sessionId, params.requestId, {
      feedback: result.feedback,
      score: result.score,
    });

    await globalThis.sessionTracker?.flush?.();

    console.log(
      `[agent] verify done pass=true score=${result.score} durationMs=${Date.now() - startedAt}`,
    );
    return { feedback: result.feedback, pass: true };
  }

  if (result.unavailable) {
    await globalThis.sessionTracker?.flush?.();

    const { verifyId } = await postVerifyCheckpoint(params.sessionId, {
      contextSnapshot: _serializeContextSnapshot(params.storage),
      feedback: result.feedback,
      parsedStageSnapshot: toParsedStageSnapshot(params.stage),
      requestId: params.requestId,
      score: 0,
      stage: spec,
      stageIndex: params.pipelineStageIndex,
      storageSnapshot: _serializeStorage(params.storage),
      unavailable: true,
    });

    await globalThis.sessionTracker?.flush?.();

    console.log(
      `[agent] verify unavailable feedback=${result.feedback} durationMs=${Date.now() - startedAt} verifyId=${verifyId}`,
    );

    await shutdownAgent(params.agentName, params.sessionId);

    throw new VerifyUnavailableError({
      feedback: result.feedback,
      requestId: params.requestId,
      stageIndex: params.pipelineStageIndex,
      verifyId,
    });
  }

  await globalThis.sessionTracker?.flush?.();

  const { verifyId } = await postVerifyCheckpoint(params.sessionId, {
    contextSnapshot: _serializeContextSnapshot(params.storage),
    feedback: result.feedback,
    parsedStageSnapshot: toParsedStageSnapshot(params.stage),
    requestId: params.requestId,
    score: result.score,
    stage: spec,
    stageIndex: params.pipelineStageIndex,
    storageSnapshot: _serializeStorage(params.storage),
    ...(result.askUserRef ? { askUserRef: result.askUserRef } : {}),
    ...(result.resumeAction ? { resumeAction: result.resumeAction } : {}),
  });

  await globalThis.sessionTracker?.flush?.();

  console.log(
    `[agent] verify done pass=false score=${result.score} durationMs=${Date.now() - startedAt} verifyId=${verifyId}`,
  );

  const failure: TVerifyGateResult = {
    ...(result.askUserRef ? { askUserRef: result.askUserRef } : {}),
    feedback: result.feedback,
    pass: false,
    ...(result.resumeAction ? { resumeAction: result.resumeAction } : {}),
    score: result.score,
    verifyId,
  };

  if (params.shutdownOnFail !== false) {
    await shutdownAgent(params.agentName, params.sessionId);
  }

  if (params.throwOnFail !== false) {
    throw new VerifyFailedError({
      feedback: result.feedback,
      requestId: params.requestId,
      score: result.score,
      stageIndex: params.pipelineStageIndex,
      verifyId,
    });
  }

  return failure;
};

export { VerifyFailedError, VerifyUnavailableError, ProduceKeysFailedError } from './errors';
