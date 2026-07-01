export const isStageFinished = (stage: {
  finishedAt?: Date | string | null;
}) => stage.finishedAt != null;

export const isStageVerifying = (stage: {
  finishedAt?: Date | string | null;
  verifyingAt?: Date | string | null;
}) => !isStageFinished(stage) && stage.verifyingAt != null;
