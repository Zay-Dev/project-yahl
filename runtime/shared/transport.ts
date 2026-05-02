import type { StageSessionInput } from "./stage-contract";

import type { ChatToolCall } from "./stage-tools";
import type { NormalizedUsage } from "./usage";

export const REQUEST_QUEUE = "yahl:requests";

export const USAGE_CHANNEL = "yahl:usage";

export const replyQueue = (requestId: string) => `yahl:reply:${requestId}`;

export type StageRequestEnvelope = {
  executionMeta?: StageExecutionMeta;
  requestId: string;
  sessionId: string;
  stageInput: StageSessionInput;
};

export type StageChatMessagePayload = {
  content?: unknown;
  role: string;
  toolCallIndex?: number;
  usageDelta?: unknown;
};

export type UsageEvent = {
  chatMessages?: StageChatMessagePayload[];
  contextAfter?: unknown;
  contextAfterTruncated?: boolean;
  contextBefore?: unknown;
  contextBeforeTruncated?: boolean;
  model: string;
  response?: {
    durationMs: number;
    reasoning: string | null;
    reply: string | null;
    toolCalls?: ChatToolCall[];
  };
  requestId: string;
  sessionId: string;
  stageInput?: StageSessionInput;
  stageInputTruncated?: boolean;
  thinkingMode: boolean;
  usage: NormalizedUsage;
};

export type StageExecutionMeta = {
  loopRef?: {
    arraySnapshot: unknown[];
    index: number;
    value: unknown;
  };
  runtimeRef: {
    generatedLine: number;
  };
  sourceRef: {
    filePath: string;
    line: number;
    text: string;
  };
  stageId: string;
  stageTextHash: string;
};

export type StageTokenTrace = {
  chatMessages?: StageChatMessagePayload[];
  contextAfter?: unknown;
  contextAfterTruncated?: boolean;
  contextBefore?: unknown;
  contextBeforeTruncated?: boolean;
  executionMeta: StageExecutionMeta;
  model: string;
  response?: UsageEvent["response"];
  requestId: string;
  sessionId: string;
  stageInput?: StageSessionInput;
  stageInputTruncated?: boolean;
  thinkingMode: boolean;
  timestamp: string;
  usage: NormalizedUsage;
};
