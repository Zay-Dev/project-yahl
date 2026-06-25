export type TCreatePendingSessionInput = {
  isBackground?: boolean;
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
    taskId: input.taskId,
    taskYahlPath: input.taskYahlPath,
    updatedAt: now,
  },
  $setOnInsert: {
    sessionId: input.sessionId,
  },
});
