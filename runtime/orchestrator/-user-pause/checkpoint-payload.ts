import type { TLoopMeta } from '@/shared/transports/-types';
import type { TResumeStage } from '@/orchestrator/-agent/-types';
import type { ParsedStage } from '@/orchestrator/-utils/yahl/types';

export type TUserPauseCheckpointPayload = {
  loopMeta?: TLoopMeta;
  requestId: string;
  stage: ParsedStage;
  stageIndex: number;
};

export const buildUserPauseCheckpointPayload = (params: {
  activeStage: ParsedStage;
  boundParsedStageIndex: number;
  loopMeta?: TLoopMeta;
  pipelineStageIndex: number;
  recoveryStages?: ParsedStage[];
  requestId: string;
  resumeStage?: TResumeStage;
}): TUserPauseCheckpointPayload => {
  const loopMeta = params.resumeStage?.loopMeta ?? params.loopMeta;

  if (params.resumeStage) {
    const outerStage = params.recoveryStages?.[params.pipelineStageIndex] ?? params.activeStage;

    return {
      ...(loopMeta ? { loopMeta } : {}),
      requestId: params.requestId,
      stage: outerStage,
      stageIndex: params.pipelineStageIndex,
    };
  }

  return {
    ...(params.loopMeta ? { loopMeta: params.loopMeta } : {}),
    requestId: params.requestId,
    stage: params.activeStage,
    stageIndex: params.boundParsedStageIndex,
  };
};
