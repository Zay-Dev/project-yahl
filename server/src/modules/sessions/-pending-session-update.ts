import type { TTaskSkillFile } from '@project-yahl/shared/yahl/task-skills';

import type { TParsedStage, TSessionRunCursor } from './-types';

export type TCreatePendingSessionInput = {
  browser?: boolean;
  isBackground?: boolean;
  parsedStages?: TParsedStage[];
  resultContextKey?: string;
  runCursor?: TSessionRunCursor;
  runInput?: Record<string, unknown>;
  sessionId: string;
  storageSeed?: Record<string, unknown>;
  taskId: string;
  taskSkills?: TTaskSkillFile[];
  taskYahl: string;
  taskYahlRefs?: Record<string, string>;
};

export const pendingSessionUpdateDoc = (
  input: TCreatePendingSessionInput,
  now = new Date(),
) => ({
  $set: {
    browser: input.browser === true,
    isBackground: input.isBackground === true,
    ...(input.parsedStages ? { parsedStages: input.parsedStages } : {}),
    runInput: input.runInput ?? {},
    ...(input.resultContextKey ? { resultContextKey: input.resultContextKey } : {}),
    ...(input.runCursor ? { runCursor: input.runCursor } : {}),
    ...(input.storageSeed ? { storageSeed: input.storageSeed } : {}),
    taskId: input.taskId,
    taskSkills: input.taskSkills ?? [],
    taskYahl: input.taskYahl,
    ...(input.taskYahlRefs ? { taskYahlRefs: input.taskYahlRefs } : {}),
    updatedAt: now,
  },
  $setOnInsert: {
    sessionId: input.sessionId,
  },
});
