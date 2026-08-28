import type { ParsedStage } from '@/orchestrator/-utils/yahl/types';
import type { TPreparedRunInput, TPreparedRunResult } from './prepared-run-types';

import { asLogicScript, isNestedLogic } from '@project-yahl/shared/yahl/logic';

import { applyRepairBudgets } from '@/orchestrator/-repair/repair-helpers';
import { toLoopIterationStage } from '@/orchestrator/-utils/yahl';

import type { TRunYahl } from '@/orchestrator/-agent/-types';

type TRunStage = TRunYahl;

export const toRepairExecutionStage = (
  stage: ParsedStage,
  nestedIndex?: number,
): ParsedStage => {
  let execution: ParsedStage;

  if (stage.type === 'plain') {
    execution = stage;
  } else {
    const nestedStages = stage.nestedStages;
    const hasNestedFragment = Boolean(nestedStages?.length)
      || isNestedLogic(stage.spec.logic);

    if (hasNestedFragment) {
      if (nestedIndex == null) {
        throw new Error(
          'repair run: nested while/loop requires nestedIndex on runCursor',
        );
      }

      const nested = nestedStages?.[nestedIndex];

      if (!nested) {
        throw new Error(
          `repair run: nestedIndex ${nestedIndex} out of range `
          + `for ${nestedStages?.length ?? 0} nested stage(s)`,
        );
      }

      execution = nested.type === 'plain'
        ? nested
        : toLoopIterationStage(nested, asLogicScript(nested.spec.logic));
    } else {
      execution = toLoopIterationStage(stage, asLogicScript(stage.spec.logic));
    }
  }

  return applyRepairBudgets(execution);
};

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
    stages: [toRepairExecutionStage(stage, cursor.nestedIndex)],
    startFromStageIndex: 0,
    systemAppend,
    useStorage: () => storage,
  });

  return {
    resultContextKey: prepared.resultContextKey,
    storage,
  };
};
