export type TResumeRunMode = 'ask-user-resume' | 'verify-resume' | 'produce-keys-resume';

export type TOrchestratorRunOptions = {
  produceKeysResumeId?: string;
  resumeId?: string;
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

  return { mode: 'session' };
};
