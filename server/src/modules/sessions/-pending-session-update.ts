export type TCreatePendingSessionInput = {
  sessionId: string;
  taskId: string;
  taskYahlPath: string;
};

export const pendingSessionUpdateDoc = (
  input: TCreatePendingSessionInput,
  now = new Date(),
) => ({
  $set: {
    taskId: input.taskId,
    taskYahlPath: input.taskYahlPath,
    updatedAt: now,
  },
  $setOnInsert: {
    sessionId: input.sessionId,
  },
});
