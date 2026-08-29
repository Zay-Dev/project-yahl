import type { ChatApiMessage } from '@/shared/stage-tools';
import type { TAskUserResumeFrom, TStorage, TLoopMeta } from '@/shared/transports/-types';
import type { ParsedStage } from '@/orchestrator/-utils/yahl/types';
import type { TStageAgentMeta } from '@project-yahl/shared/yahl/types';

export type { TStorage, TLoopMeta };

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

export type TStageUsage = {
  bashCalls?: number;
  turns?: number;
};

export type TRunYahl = (
  yahl: string,
  options?: {
    agentMeta?: TStageAgentMeta;
    contextAfter?: TStorage;
    contextAfterRecord?: Record<string, unknown>;
    forkSetupIndex?: number;
    loopMeta?: TLoopMeta;
    resumeStage?: TResumeStage;
    recoveryStages?: ParsedStage[];
    stages?: ParsedStage[];
    parsedStageIndex?: number;
    pipelineStageIndex?: number;
    prefixMessages?: ChatApiMessage[];
    produceKeysResumeAttempt?: boolean;
    repairMode?: boolean;
    startFromStageIndex?: number;
    systemAppend?: string;
    runInput?: Record<string, unknown>;
    temperature?: number;
    useStorage?: () => TStorage;
    verifyFastForward?: TVerifyFastForward;
  },
) => Promise<{
  gotoTargetStageIndex?: number;
  requestId?: string;
  storage: TStorage;
  usage?: TStageUsage;
}>;
