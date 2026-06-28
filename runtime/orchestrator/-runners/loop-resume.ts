import type { TLoopMeta, TStorage } from '@/shared/transports/-types';
import type { ParsedStage } from '@/orchestrator/-utils/yahl/types';

import { runYahl } from '@/orchestrator/-agent';
import { resumeLoopFromCheckpoint } from '@/orchestrator/-agent/loop';

export const isLoopStageCheckpoint = (
  loopMeta: TLoopMeta | undefined,
  yahlStages: ParsedStage[],
  stageIndex: number,
) => Boolean(loopMeta && yahlStages[stageIndex]?.type === 'loop');

export const continueAfterLoopIterationResume = async (params: {
  loopMeta: TLoopMeta;
  stageIndex: number;
  storage: TStorage;
  systemAppend?: string;
  yahlStages: ParsedStage[];
}) => {
  const loopStage = params.yahlStages[params.stageIndex]!;

  await resumeLoopFromCheckpoint(
    loopStage,
    params.storage,
    params.loopMeta,
    runYahl,
    params.loopMeta.temperature,
    params.stageIndex,
    params.stageIndex,
  );

  const suffix = params.yahlStages.slice(params.stageIndex + 1);

  if (!suffix.length) {
    return;
  }

  await runYahl('', {
    pipelineStageIndex: params.stageIndex + 1,
    stages: suffix,
    startFromStageIndex: 0,
    systemAppend: params.systemAppend,
    useStorage: () => params.storage,
  });
};
