import { EMPTY_VALUE, isRecord } from "@/lib/format";
import type {
  RerunRequestPayload,
  SessionStepEvent,
  SessionStepSse,
} from "@/types";

export type SessionEventRow = {
  event: SessionStepEvent;
  index: number;
};

export type SessionEventGroup = [requestId: string, rows: SessionEventRow[]];

export const getInputTokens = (event: SessionStepEvent) =>
  event.usage.cacheHitTokens + event.usage.cacheMissTokens;

export const getStagePreview = (event: SessionStepEvent) => {
  if (!event.stageInput || typeof event.stageInput !== "object") return EMPTY_VALUE;

  const stageInput = event.stageInput as { currentStage?: unknown };
  if (typeof stageInput.currentStage !== "string") return EMPTY_VALUE;

  const trimmed = stageInput.currentStage.trim();
  return trimmed || EMPTY_VALUE;
};

export const isLoopStep = (event: SessionStepEvent) => {
  if (!event.executionMeta || typeof event.executionMeta !== "object") return false;

  const executionMeta = event.executionMeta as { loopRef?: unknown };
  return typeof executionMeta.loopRef === "object" && executionMeta.loopRef !== null;
};

export const groupEventsByRequestId = (events: SessionStepEvent[]): SessionEventGroup[] => {
  if (!events.length) return [];

  const groups = new Map<string, SessionEventRow[]>();
  events.forEach((event, index) => {
    const row = groups.get(event.requestId) || [];
    row.push({ event, index });
    groups.set(event.requestId, row);
  });

  return Array.from(groups.entries());
};

export const toRequestSnapshot = (
  event: SessionStepEvent | null,
): RerunRequestPayload["requestSnapshotOverride"] | null => {
  if (!event?.stageInput || !isRecord(event.stageInput)) return null;

  const stageInput = event.stageInput as Record<string, unknown>;
  if (typeof stageInput.currentStage !== "string" || !isRecord(stageInput.context)) return null;

  const context = stageInput.context as Record<string, unknown>;

  return {
    context: {
      context: isRecord(context.context) ? context.context : {},
      stage: isRecord(context.stage) ? context.stage : {},
      types: isRecord(context.types) ? context.types : {},
    },
    currentStage: stageInput.currentStage,
  };
};

export const getRequestSnapshot = (
  rows: SessionEventRow[],
  fallback: SessionStepEvent | null,
) => {
  const fromRows = [...rows]
    .reverse()
    .map(({ event }) => toRequestSnapshot(event))
    .find((snapshot) => !!snapshot);

  return fromRows || toRequestSnapshot(fallback);
};

export const getRequestGlobalStage = (rows: SessionEventRow[]) => {
  const scopedRows = [...rows].reverse();
  const globalRow =
    scopedRows.find(({ event }) => getStagePreview(event) !== EMPTY_VALUE) ??
    scopedRows[0] ??
    null;

  return globalRow;
};

export const toLiveEvent = (step: SessionStepSse): SessionStepEvent => ({
  cost: step.cost,
  executionMeta: step.executionMeta,
  model: step.model,
  requestId: step.requestId || `live-${step.sessionId}-${step.stepIndex}`,
  response:
    step.durationMs !== null || step.replyPreview !== null
      ? {
        durationMs: step.durationMs ?? 0,
        reasoning: null,
        reply: step.replyPreview,
      }
      : undefined,
  sessionId: step.sessionId,
  stageInput: step.stageInput,
  stageInputTruncated: step.stageInputTruncated,
  thinkingMode: false,
  timestamp: "",
  usage: {
    cacheHitTokens: step.usage.cacheHitTokens,
    cacheMissTokens: step.usage.cacheMissTokens,
    completionTokens: step.usage.completionTokens,
    reasoningTokens: step.usage.reasoningTokens,
  },
});
