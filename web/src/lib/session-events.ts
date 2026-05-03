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

const currentStageFromSourceRef = (event: SessionStepEvent): string | null => {
  if (!isRecord(event.executionMeta)) return null;

  const sr = event.executionMeta.sourceRef;
  if (!isRecord(sr) || typeof sr.text !== "string") return null;

  const t = sr.text.trim();
  return t ? sr.text : null;
};

export const getCurrentStage = (event: SessionStepEvent): string | null => {
  if (typeof event.currentStage === "string" && event.currentStage.trim()) return event.currentStage;

  if (isRecord(event.stageInput) && typeof event.stageInput.currentStage === "string") {
    const v = event.stageInput.currentStage;
    if (v.trim()) return v;
  }

  return currentStageFromSourceRef(event);
};

export const getCurrentStageDisplay = (event: SessionStepEvent): string => {
  const raw = getCurrentStage(event);
  return raw ? raw : EMPTY_VALUE;
};

export const getStagePreview = (event: SessionStepEvent) => getCurrentStageDisplay(event);

export const getContextBeforeForDisplay = (event: SessionStepEvent): unknown => {
  if (event.contextBefore !== undefined) return event.contextBefore;

  if (isRecord(event.stageInput) && "context" in event.stageInput) return event.stageInput.context;

  return event.stageInput;
};

export const getContextAfterForDisplay = (event: SessionStepEvent): unknown => event.contextAfter;

export const isLoopStep = (event: SessionStepEvent) => {
  if (!isRecord(event.executionMeta)) return false;

  return isRecord(event.executionMeta.loopRef);
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

const extractContext = (event: SessionStepEvent): Record<string, unknown> | null => {
  if (isRecord(event.stageInput) && isRecord(event.stageInput.context)) {
    return event.stageInput.context;
  }

  if (isRecord(event.contextBefore)) return event.contextBefore;
  if (isRecord(event.stageInput)) return event.stageInput;

  return null;
};

export const toRequestSnapshot = (
  event: SessionStepEvent | null,
): RerunRequestPayload["requestSnapshotOverride"] | null => {
  if (!event) return null;

  const currentStage = getCurrentStage(event);
  if (!currentStage) return null;

  const context = extractContext(event);
  if (!context) return null;

  return {
    context: {
      context: isRecord(context.context) ? context.context : {},
      stage: isRecord(context.stage) ? context.stage : {},
      types: isRecord(context.types) ? context.types : {},
    },
    currentStage,
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

export const toLiveEvent = (step: SessionStepSse): SessionStepEvent => {
  const response = step.response
    ? {
      durationMs: step.response.durationMs ?? step.durationMs ?? 0,
      reasoning: step.response.reasoning,
      reply: step.response.reply,
      toolCalls: step.response.toolCalls,
    }
    : step.durationMs !== null || step.replyPreview !== null
      ? {
        durationMs: step.durationMs ?? 0,
        reasoning: null,
        reply: step.replyPreview,
      }
      : undefined;

  const contextBefore =
    step.stageInput !== undefined && isRecord(step.stageInput) && "context" in step.stageInput
      ? step.stageInput.context
      : step.stageInput;

  return {
    contextAfter: step.contextAfter,
    contextAfterTruncated: step.contextAfterTruncated,
    contextBefore,
    contextBeforeTruncated: step.stageInputTruncated,
    cost: step.cost,
    currentStage: step.currentStage ?? undefined,
    executionMeta: step.executionMeta,
    model: step.model,
    requestId: step.requestId || `live-${step.sessionId}-${step.stepIndex}`,
    response,
    sessionId: step.sessionId,
    stageChat: step.stageChat,
    stageIndex: step.stepIndex,
    stageInput: step.stageInput,
    stageInputTruncated: step.stageInputTruncated,
    thinkingMode: step.thinkingMode,
    timestamp: step.timestamp,
    usage: {
      cacheHitTokens: step.usage.cacheHitTokens,
      cacheMissTokens: step.usage.cacheMissTokens,
      completionTokens: step.usage.completionTokens,
      reasoningTokens: step.usage.reasoningTokens,
    },
  };
};
