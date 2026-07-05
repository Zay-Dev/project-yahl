import type { TPreparedRunInput, TPreparedRunResult } from './prepared-run-types';

import type { TPipelinePosition } from './pipeline-continuation';

import { resolveLoopStageIndex, runPipelineContinuation } from './pipeline-continuation';
import { resumeVerifyFromPrepared } from './resume-verify';

export const runSessionFrom = async (
  sessionId: string,
  prepared: TPreparedRunInput,
): Promise<TPreparedRunResult> => {
  const { cursor, parsedStages, storage, systemAppend } = prepared;

  if (cursor.verifyWasUnavailable) {
    return resumeVerifyFromPrepared(sessionId, prepared);
  }

  const loopStageIndex = resolveLoopStageIndex({}, parsedStages);

  let position: TPipelinePosition;
  let fromStageIndex: number;

  if (cursor.resumeStage) {
    position = {
      kind: 'resumeStageThenContinue',
      loopMeta: cursor.loopMeta ?? cursor.resumeStage.loopMeta,
      requestId: cursor.resumeStage.requestId,
      resumedStage: cursor.resumeStage.stage,
      resumeFrom: cursor.resumeStage.resumeFrom,
      stageIndex: cursor.stageIndex,
    };
    fromStageIndex = cursor.stageIndex + 1;
  } else {
    position = {
      kind: 'fromStageIndex',
      ...(cursor.produceKeysResumeAttempt ? { produceKeysResumeAttempt: true } : {}),
      stageIndex: cursor.stageIndex,
    };
    fromStageIndex = cursor.stageIndex;
  }

  await runPipelineContinuation({
    loopStageIndex: loopStageIndex >= 0 ? loopStageIndex : null,
    position,
    storage,
    suffix: { kind: 'parsedStages', fromStageIndex },
    systemAppend,
    yahlStages: parsedStages,
  });

  return {
    resultContextKey: prepared.resultContextKey,
    storage,
  };
};
