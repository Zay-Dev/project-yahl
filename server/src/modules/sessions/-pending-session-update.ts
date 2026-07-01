export type TCreatePendingSessionInput = {
  isBackground?: boolean;
  runInput?: Record<string, unknown>;
  sessionId: string;
  taskId: string;
  taskYahlPath: string;
};

export const pendingSessionUpdateDoc = (
  input: TCreatePendingSessionInput,
  now = new Date(),
) => ({
  $set: {
    isBackground: input.isBackground === true,
    ...(input.runInput !== undefined ? { runInput: input.runInput } : {}),
    taskId: input.taskId,
    taskYahlPath: input.taskYahlPath,
    updatedAt: now,
  },
  $setOnInsert: {
    sessionId: input.sessionId,
  },
});
