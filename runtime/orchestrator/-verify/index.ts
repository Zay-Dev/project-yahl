import type { TStorage } from '@/shared/transports/-types';
import type { ParsedStage } from '@/orchestrator/-utils/yahl/types';

import { composeDown } from '@/orchestrator/-docker';

import { VerifyFailedError } from './errors';
import { postVerifyCheckpoint } from './session-api';
import { toParsedStageSnapshot } from '@/orchestrator/-ask-user/parsed-stage-snapshot';

const _serializeStorage = (storage: TStorage) => ({
  context: Object.fromEntries(storage.context.entries()),
  types: Object.fromEntries(storage.types.entries()),
});

const _serializeContextSnapshot = (storage: TStorage) => ({
  context: Object.fromEntries(storage.context.entries()),
  stage: {},
  types: Object.fromEntries(storage.types.entries()),
});

export const runVerifyGate = async (params: {
  agentName: string;
  pipelineStageIndex: number;
  requestId: string;
  sessionId: string;
  stage: ParsedStage;
  storage: TStorage;
}) => {
  const { stage } = params;
  const spec = stage.spec;

  if (spec.verify !== true) {
    return;
  }

  const { callMastermindVerify } = await import('@/shared/mastermind-client');

  const result = await callMastermindVerify({
    contextSnapshot: _serializeContextSnapshot(params.storage),
    minScore: spec.verifyMinScore,
    requestId: params.requestId,
    rubric: spec.verifyRubric,
    sessionId: params.sessionId,
    stageIndex: params.pipelineStageIndex,
    stageVersion: spec.version,
  });

  if (result.pass) {
    return;
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
  });

  await globalThis.sessionTracker?.flush?.();

  await composeDown(params.agentName);

  throw new VerifyFailedError({
    feedback: result.feedback,
    requestId: params.requestId,
    score: result.score,
    stageIndex: params.pipelineStageIndex,
    verifyId,
  });
};

export { VerifyFailedError } from './errors';
