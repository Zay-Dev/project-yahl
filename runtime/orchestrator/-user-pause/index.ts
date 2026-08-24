import type { TLoopMeta, TStorage } from '@/shared/transports/-types';
import type { ParsedStage } from '@/orchestrator/-utils/yahl/types';

import { shutdownAgent } from '@/orchestrator/-docker';
import { toParsedStageSnapshot } from '@/orchestrator/-ask-user/parsed-stage-snapshot';
import { fetchSession, postUserPauseCheckpoint } from '@/orchestrator/-user-pause/session-api';

import { UserPausedError } from './errors';

const _serializeStorage = (storage: TStorage) => ({
  context: Object.fromEntries(storage.context.entries()),
  types: Object.fromEntries(storage.types.entries()),
});

const _serializeContextSnapshot = (storage: TStorage) => ({
  context: Object.fromEntries(storage.context.entries()),
  stage: {},
  types: Object.fromEntries(storage.types.entries()),
});

export const pauseForUserRequest = async (params: {
  agentName: string;
  loopMeta?: TLoopMeta;
  requestId: string;
  sessionId: string;
  stage: ParsedStage;
  stageIndex?: number;
  storage: TStorage;
}) => {
  const session = await fetchSession(params.sessionId);
  const repairInstruction = session.runCursor?.kind === 'repair'
    ? session.runCursor.repairInstruction?.trim()
    : undefined;

  await globalThis.sessionTracker?.flush?.();

  await postUserPauseCheckpoint(params.sessionId, {
    contextSnapshot: _serializeContextSnapshot(params.storage),
    ...(params.loopMeta ? { loopMeta: params.loopMeta } : {}),
    parsedStageSnapshot: toParsedStageSnapshot(params.stage),
    ...(repairInstruction ? { repairInstruction } : {}),
    requestId: params.requestId,
    stage: params.stage.spec,
    ...(params.stageIndex === undefined ? {} : { stageIndex: params.stageIndex }),
    storageSnapshot: _serializeStorage(params.storage),
  });

  await globalThis.sessionTracker?.flush?.();

  console.log(
    `[yahl-diag] user-pause requestId=${params.requestId} sessionId=${params.sessionId} pid=${process.pid}`,
  );

  await shutdownAgent(params.agentName, params.sessionId);

  throw new UserPausedError();
};
