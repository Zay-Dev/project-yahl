import type { TAskUserResumeFrom, TStorage, TLoopMeta } from '@/shared/transports/-types';
import type { ParsedStage } from '@/orchestrator/-utils/yahl/types';

export { TStorage, TLoopMeta };

type TResumeStage = {
  loopMeta?: TLoopMeta;
  requestId: string;
  resumeFrom: TAskUserResumeFrom;
  stage: ParsedStage;
};

export type TRunYahl = (
  yahl: string,
  options?: {
    contextAfter?: TStorage;
    contextAfterRecord?: Record<string, unknown>;
    forkSetupIndex?: number;
    loopMeta?: TLoopMeta;
    resumeStage?: TResumeStage;
    stages?: ParsedStage[];
    pipelineStageIndex?: number;
    startFromStageIndex?: number;
    temperature?: number;
    useStorage?: () => TStorage;
  },
) => Promise<{
  storage: TStorage;
}>;