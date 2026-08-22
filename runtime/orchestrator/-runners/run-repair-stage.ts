import type { ParsedStage } from '@/orchestrator/-utils/yahl/types';
import type { TPreparedRunInput, TPreparedRunResult } from './prepared-run-types';

import { toLoopIterationStage } from '@/orchestrator/-utils/yahl';

import type { TRunYahl } from '@/orchestrator/-agent/-types';

type TRunStage = TRunYahl;

export const toRepairExecutionStage = (stage: ParsedStage): ParsedStage =>
  stage.type === 'plain'
    ? stage
    : toLoopIterationStage(stage, stage.spec.logic);

export const runRepairStage = async (
  prepared: TPreparedRunInput,
  runStage?: TRunStage,
): Promise<TPreparedRunResult> => {
  const { cursor, parsedStages, storage, systemAppend } = prepared;
  const stage = parsedStages[cursor.stageIndex];

  if (!stage) {
    throw new Error(
      `repair run: stageIndex ${cursor.stageIndex} out of bounds `
      + `for ${parsedStages.length} stage(s)`,
    );
  }

  const execute = runStage ?? (await import('@/orchestrator/-agent')).runYahl;

  await execute('', {
    loopMeta: cursor.loopMeta,
    parsedStageIndex: cursor.stageIndex,
    pipelineStageIndex: cursor.stageIndex,
    repairMode: true,
    stages: [toRepairExecutionStage(stage)],
    startFromStageIndex: 0,
    systemAppend,
    useStorage: () => storage,
  });

  return {
    resultContextKey: prepared.resultContextKey,
    storage,
  };
};
