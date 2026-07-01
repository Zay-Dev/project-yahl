import { loadCheckpointResumeContext } from './checkpoint-resume-load';
import { resolveLoopStageIndex, runPipelineContinuation } from './pipeline-continuation';

export const runProduceKeysResume = async (sessionId: string, verifyId: string) => {
  const {
    activeStage,
    checkpoint,
    session,
    stageIndex,
    storage,
    yahlStages,
  } = await loadCheckpointResumeContext(sessionId, verifyId);

  const feedback = String(checkpoint.feedback ?? '');
  const requestId = String(checkpoint.requestId ?? '');
  const systemAppend = [
    'The stage previously failed to produce required context keys.',
    feedback,
    'Use set_context to write every missing produceContextKeys value before finishing.',
  ].join('\n\n');

  const loopStageIndex = resolveLoopStageIndex({}, yahlStages);

  const resultStorage = await runPipelineContinuation({
    loopStageIndex: loopStageIndex >= 0 ? loopStageIndex : null,
    position: {
      kind: 'fromStageIndex',
      produceKeysResumeAttempt: true,
      requestId,
      resumedStage: activeStage,
      stageIndex,
    },
    storage,
    suffix: {
      kind: 'parsedStages',
      fromStageIndex: stageIndex,
    },
    systemAppend,
    yahlStages,
  });

  return {
    resultContextKey: session.resultContextKey ?? 'result',
    storage: resultStorage,
  };
};
