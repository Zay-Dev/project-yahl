export const isStageFinished = (stage: {
  finishedAt?: Date | string | null;
}) => stage.finishedAt != null;
