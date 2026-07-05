import type { TAskUserResumeFrom, TLoopMeta, TStorage } from '@/shared/transports/-types';
import type { ParsedStage } from '@/orchestrator/-utils/yahl/types';

export type TRunStartCursor = {
  kind: 'pipeline';
  loopMeta?: TLoopMeta;
  produceKeysResumeAttempt?: boolean;
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
  runInput?: Record<string, unknown>;
  storage: TStorage;
  systemAppend?: string;
  taskYahl: string;
};

export type TPreparedRunResult = {
  resultContextKey: string;
  storage: TStorage;
};
