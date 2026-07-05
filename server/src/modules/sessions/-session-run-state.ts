import fs from 'fs';

import { isAgentContainerRunning } from './-agent-run-active';
import { orchestratorRunLockPath } from './-orchestrator-run-lock';
import { resolvePausedStageRequestIds } from './-paused-stage-request-ids';
import {
  resolveSessionRunStateFromSignals,
  type TSessionRunState,
} from './-session-run-state-signals';

export type { TSessionRunState } from './-session-run-state-signals';

const _isOrchestratorActive = (sessionId: string) => {
  const lockPath = orchestratorRunLockPath(sessionId);

  if (!fs.existsSync(lockPath)) {
    return false;
  }

  const raw = fs.readFileSync(lockPath, 'utf8').trim();
  const pid = Number.parseInt(raw, 10);

  if (!Number.isFinite(pid)) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

export const resolveSessionRunState = async (params: {
  sessionId: string;
  sessionRef: string;
  stages: Array<{
    finishedAt?: Date | string | null;
    requestId?: string;
    verifyingAt?: Date | string | null;
  }>;
}): Promise<TSessionRunState> => {
  const pausedRequestIds = await resolvePausedStageRequestIds(params.sessionRef);

  return resolveSessionRunStateFromSignals({
    agentActive: isAgentContainerRunning(params.sessionId),
    orchestratorActive: _isOrchestratorActive(params.sessionId),
    pausedRequestIds,
    stages: params.stages,
  });
};
