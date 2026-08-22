import type { TAskUserResumeFrom, TLoopMeta, TStorage } from '@/shared/transports/-types';
import type { ParsedStage } from '@/orchestrator/-utils/yahl/types';

export type TRunStartCursor = {
  kind: 'pipeline' | 'repair';
  loopMeta?: TLoopMeta;
  produceKeysResumeAttempt?: boolean;
  repairInstruction?: string;
  resumeStage?: {
    loopMeta?: TLoopMeta;
    requestId: string;
    resumeFrom?: TAskUserResumeFrom;
    stage: ParsedStage;
  };
  stageIndex: number;
  verifyWasUnavailable?: boolean;
  verifyWasUnavailableWithProducedKeys?: boolean;
};

export type TPreparedRunInput = {
  cursor: TRunStartCursor;
  parsedStages: ParsedStage[];
  resultContextKey: string;
  storage: TStorage;
  systemAppend?: string;
  taskYahl: string;
};

export type TPreparedRunResult = {
  resultContextKey: string;
  storage: TStorage;
};
