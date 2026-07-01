import type { TTaskSkillFile } from '@project-yahl/shared/yahl/task-skills';

export type TCreatePendingSessionInput = {
  isBackground?: boolean;
  runInput?: Record<string, unknown>;
  sessionId: string;
  taskId: string;
  taskSkills?: TTaskSkillFile[];
  taskYahl: string;
};

export const pendingSessionUpdateDoc = (
  input: TCreatePendingSessionInput,
  now = new Date(),
) => ({
  $set: {
    isBackground: input.isBackground === true,
    runInput: input.runInput ?? {},
    taskId: input.taskId,
    taskSkills: input.taskSkills ?? [],
    taskYahl: input.taskYahl,
    updatedAt: now,
  },
  $setOnInsert: {
    sessionId: input.sessionId,
  },
});
