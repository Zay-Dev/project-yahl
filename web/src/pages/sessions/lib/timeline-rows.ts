import type {
  TResponseModelUsageByModel,
  TResponseStageListItem,
  TResponseStageStatus,
  TResponseTokenTotals,
} from "@project-yahl/server/modules/sessions/-api-types";

import { buildStageLabels, resolveLoopKind } from "@/pages/sessions/lib/stage-label";

export type TTimelineStageRow = {
  kind: "stage";
  item: TResponseStageListItem;
  label: string;
  stageIndex: number;
};

export type TTimelineGroupRow = {
  kind: "group";
  childRequestIds: string[];
  item: TResponseStageListItem;
  label: string;
};

export type TTimelineRow = TTimelineGroupRow | TTimelineStageRow;

const emptyTotals = (): TResponseTokenTotals => ({
  cacheHitTokens: 0,
  cacheMissTokens: 0,
  completionTokens: 0,
  promptTokens: 0,
  reasoningTokens: 0,
  totalTokens: 0,
});

const addTotals = (
  left: TResponseTokenTotals | null,
  right: TResponseTokenTotals | null,
): TResponseTokenTotals | null => {
  if (!left && !right) {
    return null;
  }

  const a = left ?? emptyTotals();
  const b = right ?? emptyTotals();

  return {
    cacheHitTokens: a.cacheHitTokens + b.cacheHitTokens,
    cacheMissTokens: a.cacheMissTokens + b.cacheMissTokens,
    completionTokens: a.completionTokens + b.completionTokens,
    promptTokens: a.promptTokens + b.promptTokens,
    reasoningTokens: a.reasoningTokens + b.reasoningTokens,
    totalTokens: a.totalTokens + b.totalTokens,
  };
};

const mergeByModel = (rows: TResponseStageListItem[]): TResponseModelUsageByModel[] => {
  const byKey = new Map<string, TResponseModelUsageByModel>();

  for (const row of rows) {
    for (const entry of row.byModel) {
      const key = entry.model;
      const prev = byKey.get(key);

      if (!prev) {
        byKey.set(key, {
          domains: [...entry.domains],
          model: entry.model,
          tokenTotals: entry.tokenTotals
            ? { ...entry.tokenTotals }
            : null,
        });
        continue;
      }

      const domains = new Set([...prev.domains, ...entry.domains]);

      byKey.set(key, {
        domains: [...domains],
        model: entry.model,
        tokenTotals: addTotals(prev.tokenTotals, entry.tokenTotals),
      });
    }
  }

  return [...byKey.values()];
};

const rollupStatus = (rows: TResponseStageListItem[]): TResponseStageStatus => {
  if (rows.some((row) => row.status === "running")) {
    return "running";
  }

  if (rows.some((row) => row.status === "verifying")) {
    return "verifying";
  }

  return "finished";
};

export const isNestedTimelineStage = (item: TResponseStageListItem) =>
  Boolean(item.agentMeta?.nestedPath?.trim());

const nestedGroupKey = (item: TResponseStageListItem) => {
  const parent = item.agentMeta?.parentRequestId ?? "none";
  const parsed = item.parsedStageIndex ?? "x";
  const loop = item.loopIndex ?? "plain";

  return `${parsed}:${loop}:${parent}`;
};

export const groupLabelFromChildLabel = (childLabel: string) => {
  const cut = childLabel.indexOf(" › ");

  if (cut < 0) {
    return childLabel;
  }

  return childLabel.slice(0, cut);
};

export const rollupNestedGroupItem = (
  children: TResponseStageListItem[],
  groupRequestId: string,
): TResponseStageListItem => {
  const first = children[0]!;
  const last = children[children.length - 1]!;
  const domains = [...new Set(children.flatMap((row) => row.domains))];

  return {
    agentMeta: {
      isMainThread: false,
      nestedPath: first.agentMeta?.nestedPath?.split("/")[0] ?? "nested",
      parentRequestId: first.agentMeta?.parentRequestId,
    },
    byModel: mergeByModel(children),
    createdAt: first.createdAt,
    domains,
    finishedAt: children.every((row) => row.status === "finished")
      ? last.finishedAt ?? last.updatedAt
      : undefined,
    lastModelDurationMs: children.reduce((sum, row) => sum + row.lastModelDurationMs, 0),
    logicPreview: children
      .map((row) => row.agentMeta?.nestedPath?.split("/").at(-1) ?? row.logicPreview)
      .filter(Boolean)
      .join(" → "),
    loopIndex: first.loopIndex,
    loopKind: first.loopKind,
    loopSetup: first.loopSetup,
    modelCallCount: children.reduce((sum, row) => sum + row.modelCallCount, 0),
    modelDurationMs: children.reduce((sum, row) => sum + row.modelDurationMs, 0),
    parsedStageIndex: first.parsedStageIndex,
    remainingBashCalls: last.remainingBashCalls,
    remainingTurns: last.remainingTurns,
    requestId: groupRequestId,
    stageId: `group:${groupRequestId}`,
    status: rollupStatus(children),
    tokenTotals: children.reduce<TResponseTokenTotals | null>(
      (acc, row) => addTotals(acc, row.tokenTotals),
      null,
    ),
    toolCallCount: children.reduce((sum, row) => sum + row.toolCallCount, 0),
    updatedAt: last.updatedAt,
    whileSetup: first.whileSetup,
  };
};

export const buildTimelineRows = (stages: TResponseStageListItem[]): TTimelineRow[] => {
  const labels = buildStageLabels(stages);
  const rows: TTimelineRow[] = [];
  const seenGroups = new Set<string>();

  stages.forEach((item, stageIndex) => {
    const label = labels[stageIndex] ?? `#${stageIndex + 1}`;
    const nestedWhile = isNestedTimelineStage(item)
      && resolveLoopKind(item) === "while";

    if (nestedWhile) {
      const key = nestedGroupKey(item);

      if (!seenGroups.has(key)) {
        seenGroups.add(key);

        const children = stages.filter((candidate) =>
          isNestedTimelineStage(candidate)
          && resolveLoopKind(candidate) === "while"
          && nestedGroupKey(candidate) === key);

        const groupRequestId = `group:${key}`;

        rows.push({
          kind: "group",
          childRequestIds: children.map((child) => child.requestId),
          item: rollupNestedGroupItem(children, groupRequestId),
          label: groupLabelFromChildLabel(label),
        });
      }
    }

    rows.push({
      kind: "stage",
      item,
      label,
      stageIndex,
    });
  });

  return rows;
};
