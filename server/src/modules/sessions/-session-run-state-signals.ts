import { isStageFinished } from './-stage-status';

export type TSessionRunState = 'active' | 'idle' | 'stuck';

export const resolveSessionRunStateFromSignals = (params: {
  agentActive: boolean;
  orchestratorActive: boolean;
  pausedRequestIds?: ReadonlySet<string>;
  stages: Array<{
    finishedAt?: Date | string | null;
    requestId?: string;
    verifyingAt?: Date | string | null;
  }>;
}): TSessionRunState => {
  if (params.agentActive || params.orchestratorActive) {
    return 'active';
  }

  const hasOpenStage = params.stages.some((stage) => {
    if (isStageFinished(stage)) {
      return false;
    }

    if (stage.requestId && params.pausedRequestIds?.has(stage.requestId)) {
      return false;
    }

    return true;
  });

  if (!hasOpenStage) {
    return 'idle';
  }

  return 'stuck';
};
