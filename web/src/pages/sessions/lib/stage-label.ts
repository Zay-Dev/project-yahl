import type { TResponseStageListItem } from "@project-yahl/server/modules/sessions/-api-types";

export const resolveLoopKind = (
  item: Pick<TResponseStageListItem, "loopIndex" | "loopKind">,
) => {
  if (item.loopKind) {
    return item.loopKind;
  }

  if (typeof item.loopIndex === "number") {
    return "for" as const;
  }

  return undefined;
};

const loopGroupKey = (item: TResponseStageListItem) => {
  if (typeof item.parsedStageIndex === "number") {
    return `p:${item.parsedStageIndex}`;
  }

  if (item.agentMeta?.parentRequestId) {
    return `parent:${item.agentMeta.parentRequestId}`;
  }

  return `l:${item.logicPreview}`;
};

const nestedLeaf = (item: TResponseStageListItem) => {
  const path = item.agentMeta?.nestedPath?.trim();

  if (!path) {
    return undefined;
  }

  return path.includes("/") ? path.slice(path.lastIndexOf("/") + 1) : path;
};

export const buildStageLabels = (stages: TResponseStageListItem[]): string[] => {
  let n = 0;
  let prevGroup: string | null = null;
  const labels: string[] = [];

  stages.forEach((item) => {
    if (item.isTypesPreamble) {
      labels.push("Types");
      return;
    }

    const loopKind = resolveLoopKind(item);
    const isWhileVerifyRow = !loopKind
      && Boolean(item.whileSetup)
      && typeof item.parsedStageIndex === "number";
    const leaf = nestedLeaf(item);
    const suffix = leaf ? ` › ${leaf}` : "";

    if (loopKind || isWhileVerifyRow) {
      const groupKey = loopGroupKey(item);

      if (groupKey !== prevGroup) {
        n += 1;
        prevGroup = groupKey;
      }

      if (isWhileVerifyRow) {
        labels.push(`#${n}.verify`);
        return;
      }

      if (loopKind === "warmup") {
        labels.push(`#${n}.warmUp${suffix}`);
        return;
      }

      labels.push(`#${n}.${item.loopIndex ?? 0}${suffix}`);
      return;
    }

    n += 1;
    prevGroup = null;
    labels.push(`#${n}${suffix}`);
  });

  return labels;
};

export const loopSetupHint = (
  stages: TResponseStageListItem[],
  index: number,
) => {
  const item = stages[index];

  if (!item || !resolveLoopKind(item)) {
    return undefined;
  }

  const prev = index > 0 ? stages[index - 1] : undefined;
  const isGroupStart = typeof item.parsedStageIndex === "number"
    ? prev?.parsedStageIndex !== item.parsedStageIndex
    : !prev || !resolveLoopKind(prev);

  if (!isGroupStart) {
    return undefined;
  }

  if (typeof item.whileSetup === "string") {
    return item.whileSetup;
  }

  if (item.whileSetup?.condition) {
    return item.whileSetup.condition;
  }

  return item.loopSetup;
};
