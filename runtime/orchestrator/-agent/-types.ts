import type { TAskUserResumeFrom, TStorage, TLoopMeta } from '@/shared/transports/-types';
import type { ParsedStage } from '@/orchestrator/-utils/yahl/types';

export { TStorage, TLoopMeta };

export type TResumeStage = {
  loopMeta?: TLoopMeta;
  requestId: string;
  resumeFrom?: TAskUserResumeFrom;
  stage: ParsedStage;
};

export type TVerifyFastForward = {
  feedback: string;
  score: number;
};

export type TRunYahl = (
  yahl: string,
  options?: {
    contextAfter?: TStorage;
    contextAfterRecord?: Record<string, unknown>;
    forkSetupIndex?: number;
    loopMeta?: TLoopMeta;
    resumeStage?: TResumeStage;
    recoveryStages?: ParsedStage[];
    stages?: ParsedStage[];
    parsedStageIndex?: number;
    pipelineStageIndex?: number;
    produceKeysResumeAttempt?: boolean;
    startFromStageIndex?: number;
    systemAppend?: string;
    runInput?: Record<string, unknown>;
    temperature?: number;
    useStorage?: () => TStorage;
    verifyFastForward?: TVerifyFastForward;
  },
) => Promise<{
  storage: TStorage;
}>;