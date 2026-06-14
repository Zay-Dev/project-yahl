import type { TResponseStageListItem } from "@project-yahl/server/modules/sessions/-api-types";

export const buildStageLabels = (stages: TResponseStageListItem[]): string[] => {
  let n = 0;
  let prevLoopKey: string | null = null;
  const labels: string[] = [];

  stages.forEach((item) => {
    if (typeof item.loopIndex === "number") {
      const loopKey = item.logicPreview;

      if (loopKey !== prevLoopKey) {
        n += 1;
        prevLoopKey = loopKey;
      }

      labels.push(`#${n}.${item.loopIndex}`);

      return;
    }

    n += 1;
    prevLoopKey = null;
    labels.push(`#${n}`);
  });

  return labels;
};
