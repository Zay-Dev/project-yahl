import type { TAskUserResumeFrom, TStorage, TLoopMeta } from '@/shared/transports/-types';
import type { ParsedStage } from '@/orchestrator/-utils/yahl/types';

export { TStorage, TLoopMeta };

export type TResumeStage = {
  loopMeta?: TLoopMeta;
  requestId: string;
  resumeFrom?: TAskUserResumeFrom;
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
    produceKeysResumeAttempt?: boolean;
    startFromStageIndex?: number;
    systemAppend?: string;
    temperature?: number;
    useStorage?: () => TStorage;
  },
) => Promise<{
  storage: TStorage;
}>;