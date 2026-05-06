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

const toChatContentText = (content: unknown): string | null => {
  if (typeof content === "string") return content.trim() ? content : null;
  if (content === null || content === undefined) return null;

  if (Array.isArray(content)) {
    const merged = content
      .map((item) => toChatContentText(item))
      .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      .join("\n");

    return merged.trim() ? merged : null;
  }

  if (isRecord(content)) {
    if (typeof content.text === "string" && content.text.trim()) return content.text;
  }

  const serialized = JSON.stringify(content);
  return serialized && serialized !== "{}" && serialized !== "[]" ? serialized : null;
};

export const getStageChatTranscript = (event: SessionStepEvent): string | null => {
  if (!Array.isArray(event.stageChat) || !event.stageChat.length) return null;

  const merged = event.stageChat
    .map((row) => toChatContentText(row.content))
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .join("\n\n");

  return merged.trim() ? merged : null;
};

const currentStageFromSourceRef = (event: SessionStepEvent): string | null => {
  if (!isRecord(event.executionMeta)) return null;
  const sourceRef = event.executionMeta.sourceRef;
  if (!isRecord(sourceRef) || typeof sourceRef.text !== "string") return null;

  return sourceRef.text.trim() ? sourceRef.text : null;
};

export const getCurrentStage = (event: SessionStepEvent): string | null => {
  if (typeof event.currentStage === "string" && event.currentStage.trim()) return event.currentStage;

  return currentStageFromSourceRef(event);
};

export const getCurrentStageDisplay = (event: SessionStepEvent): string => {
  const raw = getCurrentStage(event);
  return raw ? raw : EMPTY_VALUE;
};

export const getStagePreview = (event: SessionStepEvent) => getCurrentStageDisplay(event);

export const getStageChatDisplay = (event: SessionStepEvent): string => {
  const raw = getStageChatTranscript(event);
  return raw ? raw : EMPTY_VALUE;
};

export const getContextBeforeForDisplay = (event: SessionStepEvent): unknown => {
  return event.contextBefore;
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
  if (isRecord(event.contextBefore)) return event.contextBefore;

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
    executionMeta: step.executionMeta,
    model: step.model,
    requestId: step.requestId || `live-${step.sessionId}-${step.stepIndex}`,
    response,
    sessionId: step.sessionId,
    stageChat: step.stageChat,
    stageIndex: step.stepIndex,
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
