import type { TStorage } from '@/shared/transports/-types';
import type { ParsedStage } from '@/orchestrator/-utils/yahl/types';

import { shutdownAgent } from '@/orchestrator/-docker';

import { VerifyFailedError, VerifyUnavailableError } from './errors';
import { nixeryVerifyApi } from './nixery-verify';
import { postVerifyCheckpoint, postVerifyPass, postVerifyStart } from './session-api';
import { resolveVerifyResumeEnabled, toVerifyStageSnapshot } from './stage-snapshot';
import { toParsedStageSnapshot } from '@/orchestrator/-ask-user/parsed-stage-snapshot';

export type TVerifyGateResult = {
  askUserRef?: string;
  feedback: string;
  pass: true;
} | {
  askUserRef?: string;
  failedChecks?: { id: string; reason: string }[];
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

const persistVerifyCheckpoint = async (params: {
  body: Record<string, unknown>;
  requestId: string;
  sessionId: string;
  storage: TStorage;
}) => {
  try {
    return await postVerifyCheckpoint(params.sessionId, params.body);
  } catch (error) {
    console.error(
      `[agent] verify checkpoint persist failed sessionId=${params.sessionId} `
      + `requestId=${params.requestId}`,
      error,
    );

    try {
      globalThis.publisher?.emitStageFinish({
        contextAfter: params.storage,
        requestId: params.requestId,
      });
      await globalThis.sessionTracker?.flush?.();
    } catch (finishError) {
      console.error(
        `[agent] verify row finish after checkpoint fail failed requestId=${params.requestId}`,
        finishError,
      );
    }

    throw error;
  }
};

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
  const verify = spec.verify;

  if (!verify || typeof verify !== 'object') {
    return { feedback: '', pass: true };
  }

  const startedAt = Date.now();

  console.log(
    `[agent] verify start sessionId=${params.sessionId} requestId=${params.requestId} `
    + `stageIndex=${params.pipelineStageIndex} defId=${verify.defId}`,
  );

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

  const stageSnapshot = toVerifyStageSnapshot(spec);
  const verifyInput: Record<string, unknown> = {
    contextSnapshot: JSON.stringify(_serializeContextSnapshot(params.storage)),
    minScore: String(verify.minScore ?? 0.75),
    requestId: params.requestId,
    stageIndex: String(params.pipelineStageIndex),
    verifyResume: String(resolveVerifyResumeEnabled(spec)),
    ...(verify.rubric ? { rubric: verify.rubric } : {}),
    ...(Object.keys(stageSnapshot).length
      ? { stageSnapshot: JSON.stringify(stageSnapshot) }
      : {}),
  };

  let result = await nixeryVerifyApi.run({
    defId: verify.defId,
    input: verifyInput,
    requestId: params.requestId,
    sessionId: params.sessionId,
  });

  if (!result.pass && result.unavailable) {
    await sleep(VERIFY_UNAVAILABLE_RETRY_MS);
    result = await nixeryVerifyApi.run({
      defId: verify.defId,
      input: verifyInput,
      requestId: params.requestId,
      sessionId: params.sessionId,
    });
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

    const { verifyId } = await persistVerifyCheckpoint({
      body: {
        contextSnapshot: _serializeContextSnapshot(params.storage),
        feedback: result.feedback,
        parsedStageSnapshot: toParsedStageSnapshot(params.stage),
        requestId: params.requestId,
        score: 0,
        stage: spec,
        stageIndex: params.pipelineStageIndex,
        storageSnapshot: _serializeStorage(params.storage),
        unavailable: true,
      },
      requestId: params.requestId,
      sessionId: params.sessionId,
      storage: params.storage,
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

  const { verifyId } = await persistVerifyCheckpoint({
    body: {
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
    },
    requestId: params.requestId,
    sessionId: params.sessionId,
    storage: params.storage,
  });

  await globalThis.sessionTracker?.flush?.();

  console.log(
    `[agent] verify done pass=false score=${result.score} durationMs=${Date.now() - startedAt} verifyId=${verifyId}`,
  );

  const failure: TVerifyGateResult = {
    ...(result.askUserRef ? { askUserRef: result.askUserRef } : {}),
    ...(result.failedChecks?.length ? { failedChecks: result.failedChecks } : {}),
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
