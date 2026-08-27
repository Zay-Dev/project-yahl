export type TResumeRunMode =
  | 'ask-user-resume'
  | 'produce-keys-resume'
  | 'user-pause-resume'
  | 'verify-resume';

export type TOrchestratorRunOptions = {
  produceKeysResumeId?: string;
  resumeId?: string;
  userPauseResumeId?: string;
  verifyResumeId?: string;
};

export type TOrchestratorRun =
  | { mode: 'session' }
  | { mode: TResumeRunMode; resumeId: string };

export const resolveOrchestratorRun = (options: TOrchestratorRunOptions): TOrchestratorRun => {
  if (options.resumeId) {
    return { mode: 'ask-user-resume', resumeId: options.resumeId };
  }

  if (options.verifyResumeId) {
    return { mode: 'verify-resume', resumeId: options.verifyResumeId };
  }

  if (options.produceKeysResumeId) {
    return { mode: 'produce-keys-resume', resumeId: options.produceKeysResumeId };
  }

  if (options.userPauseResumeId) {
    return { mode: 'user-pause-resume', resumeId: options.userPauseResumeId };
  }

  return { mode: 'session' };
};
