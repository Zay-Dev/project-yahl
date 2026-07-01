import type { TLoopMeta, TStorage } from '@/shared/transports/-types';
import type { ParsedStage } from '@/orchestrator/-utils/yahl/types';

import { runPipelineContinuation } from './pipeline-continuation';

export { isLoopStageCheckpoint, resolveLoopStageIndex } from './pipeline-continuation';

export const continueAfterLoopIterationResume = async (params: {
  loopMeta: TLoopMeta;
  stageIndex: number;
  storage: TStorage;
  systemAppend?: string;
  yahlStages: ParsedStage[];
}) => {
  await runPipelineContinuation({
    loopStageIndex: params.stageIndex,
    position: {
      kind: 'loopAfterIteration',
      loopMeta: params.loopMeta,
      loopStageIndex: params.stageIndex,
    },
    storage: params.storage,
    suffix: {
      kind: 'parsedStages',
      fromStageIndex: params.stageIndex + 1,
    },
    systemAppend: params.systemAppend,
    yahlStages: params.yahlStages,
  });
};
