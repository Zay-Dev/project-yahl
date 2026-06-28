import { isStageFinished } from './-stage-status';

export type TSessionRunState = 'active' | 'idle' | 'stuck';

export const resolveSessionRunStateFromSignals = (params: {
  agentActive: boolean;
  orchestratorActive: boolean;
  stages: Array<{
    finishedAt?: Date | string | null;
    verifyingAt?: Date | string | null;
  }>;
}): TSessionRunState => {
  if (params.agentActive || params.orchestratorActive) {
    return 'active';
  }

  const hasOpenStage = params.stages.some((stage) => !isStageFinished(stage));

  if (!hasOpenStage) {
    return 'idle';
  }

  return 'stuck';
};
