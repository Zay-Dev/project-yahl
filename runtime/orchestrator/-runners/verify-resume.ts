import { runYahl } from '@/orchestrator/-agent';

import { loadCheckpointResumeContext } from './checkpoint-resume-load';

export const runVerifyResume = async (sessionId: string, verifyId: string) => {
  const {
    activeStage,
    checkpoint,
    session,
    stageIndex,
    storage,
    yahlStages,
  } = await loadCheckpointResumeContext(sessionId, verifyId);

  const feedback = String(checkpoint.feedback ?? '');
  storage.context.set('verify_feedback', feedback);

  const requestId = String(checkpoint.requestId ?? '');

  const { storage: resultStorage } = await runYahl('', {
    resumeStage: {
      requestId,
      stage: activeStage,
    },
    stages: yahlStages,
    startFromStageIndex: stageIndex,
    useStorage: () => storage,
  });

  return {
    resultContextKey: session.resultContextKey ?? 'result',
    storage: resultStorage,
  };
};
