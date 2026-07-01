export type TForkSourceSession = {
  parsedStages?: unknown[];
  taskId?: string;
  taskSkills?: unknown[];
  taskYahl?: string;
};

export class ForkSourceBundleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ForkSourceBundleError';
  }
}

export const validateForkSourceBundle = (sourceSession: TForkSourceSession) => {
  if (!sourceSession.parsedStages?.length) {
    throw new ForkSourceBundleError('Source session is missing parsedStages; cannot fork');
  }

  if (!sourceSession.taskSkills?.length) {
    throw new ForkSourceBundleError(
      'Source session is missing taskSkills snapshot; re-run the source session before forking',
    );
  }

  if (!sourceSession.taskYahl?.trim()) {
    throw new ForkSourceBundleError(
      'Source session is missing taskYahl snapshot; re-run the source session before forking',
    );
  }

  const sourceTaskId = sourceSession.taskId?.trim();

  if (!sourceTaskId) {
    throw new ForkSourceBundleError('Source session is missing taskId; cannot fork');
  }

  return sourceTaskId;
};
