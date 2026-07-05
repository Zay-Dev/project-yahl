import { sessionReferencesTaskSkills } from '@project-yahl/shared/yahl/session-references-task-skills';

export type TForkSourceSession = {
  parsedStages?: Array<{ lines: string }>;
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

  if (!sourceSession.taskYahl?.trim()) {
    throw new ForkSourceBundleError(
      'Source session is missing taskYahl snapshot; re-run the source session before forking',
    );
  }

  const needsTaskSkills = sessionReferencesTaskSkills({
    parsedStages: sourceSession.parsedStages,
    taskYahl: sourceSession.taskYahl,
  });

  if (needsTaskSkills && !sourceSession.taskSkills?.length) {
    throw new ForkSourceBundleError(
      'Source session references ~/task-skills/ but has no taskSkills snapshot; re-run the source session before forking',
    );
  }

  const sourceTaskId = sourceSession.taskId?.trim();

  if (!sourceTaskId) {
    throw new ForkSourceBundleError('Source session is missing taskId; cannot fork');
  }

  return sourceTaskId;
};
