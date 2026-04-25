import type { ContextScope, RuntimeBucket, StageContextPayload } from "../shared/stage-contract";

const TAB_SIZE = 2 as const;
const DEFAULT_END_LINE_WITH = ";" as const;

export type RuntimeContext = Map<RuntimeBucket, Record<string, unknown>>;

const getBucket = (scope: ContextScope): RuntimeBucket =>
  scope === "global" ? "context" : "stage";

export const createRuntimeContext = (): RuntimeContext => new Map<RuntimeBucket, Record<string, unknown>>([
  ["context", {}],
  ["stage", {}],
]);

export const resetStageContext = (runtime: RuntimeContext) => {
  runtime.set("stage", {});
};

export const setContextValue = (
  runtime: RuntimeContext,
  scope: ContextScope,
  key: string,
  value: unknown,
) => {
  const bucketKey = getBucket(scope);
  const current = runtime.get(bucketKey) || {};

  runtime.set(bucketKey, {
    ...current,
    [key]: value,
  });
};

export const toStageContextPayload = (runtime: RuntimeContext): StageContextPayload => ({
  context: { ...(runtime.get("context") || {}) },
  stage: { ...(runtime.get("stage") || {}) },
});

export const getStages = (text: string, tabIndex = 0) => {
  type Stage = {
    type: 'plain' | 'loop';
    closed: boolean;
    lines: string[];
    openedBy: string;
  };

  const stages: Stage[] = [];
  const tabSize = tabIndex * TAB_SIZE;

  for (const line of text.split("\n")) {
    const numberOfWhitespaces = (line.match(/^[\s]+/)?.[0] || "").length;
    const isOpenOrClose = numberOfWhitespaces <= tabSize;

    if (isOpenOrClose) {
      const lastStage = stages.at(-1);

      if (!lastStage || lastStage.closed) {
        if (!line) continue;

        stages.push({
          closed: false,
          lines: [],
          openedBy: line.at(-1) || '',
          type: line.match(/^\s*for each\s+(\w+)\s+of\s+(\[.*\])/i) &&
            ['{', '}'].find(char => line.trim().endsWith(char)) ? 'loop' : 'plain',
        });
      }
    }

    const currentStage = stages.at(-1);
    if (!currentStage) continue;

    const endLineWith = (() => {
      switch (currentStage.openedBy) {
        case '{':
          return '}';
        case '[':
          return ']';
        default:
          return DEFAULT_END_LINE_WITH;
      }
    })();

    currentStage.lines.push(line);
    currentStage.closed = isOpenOrClose &&
      (line.endsWith(endLineWith) || line.endsWith(`${endLineWith};`));
  }

  return stages.map((stage) => ({
    type: stage.type,
    lines: stage.lines.join("\n"),
  }));
};

export const extractAiLogic = (text: string) =>
  text
    .match(/```ai\.logic\n(.*)\n```/s)?.[0]
    ?.replace(/^```ai\.logic\n/, "")
    ?.replace(/\n```$/, "")
    ?.trim() || "";
