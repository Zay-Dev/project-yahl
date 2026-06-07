import type { TResponseStageListItem } from "@project-yahl/server/modules/sessions/-api-types";

export const filterLaterStagesForRerun = (
  stages: TResponseStageListItem[],
  anchor: TResponseStageListItem,
) => {
  const anchorIndex = stages.findIndex((item) => item.stageId === anchor.stageId);

  if (anchorIndex < 0) {
    return [];
  }

  const later = stages.slice(anchorIndex + 1);
  const loopSetup = anchor.loopSetup?.trim();

  if (!loopSetup) {
    return later;
  }

  return later.filter((item) => item.loopSetup?.trim() !== loopSetup);
};
