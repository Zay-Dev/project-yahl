import type { TParsedStage } from "@project-yahl/server/modules/sessions/-types";

export type TLaterOriginalStage = {
  parsed: TParsedStage;
  parsedStageIndex: number;
};

export const laterOriginalStagesForRerun = (
  originalStages: TParsedStage[],
  anchorParsedStageIndex: number | undefined,
): TLaterOriginalStage[] => {
  if (anchorParsedStageIndex == null || anchorParsedStageIndex < 0) {
    return [];
  }

  return originalStages.slice(anchorParsedStageIndex + 1).map((parsed, offset) => ({
    parsed,
    parsedStageIndex: anchorParsedStageIndex + 1 + offset,
  }));
};

export const laterOriginalStageLabel = (
  parsed: TParsedStage,
  parsedStageIndex: number,
) => {
  const slot = `task #${parsedStageIndex + 1}`;
  const id = parsed.spec.id?.trim();

  if (id) {
    return `${id} (${slot})`;
  }

  return slot;
};
