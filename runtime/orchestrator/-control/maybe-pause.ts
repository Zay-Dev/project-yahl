import type { TLoopMeta, TStorage } from '@/shared/transports/-types';
import type { ParsedStage } from '@/orchestrator/-utils/yahl/types';

import { readSessionPauseRequested } from '@/orchestrator/-control/read-signal';
import { pauseForUserRequest } from '@/orchestrator/-user-pause';

export const maybePauseForUserRequest = async (params: {
  agentName: string;
  loopMeta?: TLoopMeta;
  requestId: string;
  sessionId: string;
  stage: ParsedStage;
  stageIndex?: number;
  storage: TStorage;
}) => {
  const pauseRequested = await readSessionPauseRequested(params.sessionId);

  if (!pauseRequested) {
    return;
  }

  await pauseForUserRequest(params);
};
