export type SessionChatMessagePayload = {
  content?: unknown;
  role: string;
  toolCallIndex?: number;
  usageDelta?: unknown;
};

export type ParsedStageWire = {
  lines: string;
  sourceStartLine: number;
  type: "loop" | "plain";
};

export type CreateStagePayload = {
  contextBefore?: unknown;
  contextBeforeTruncated?: boolean;
  currentStage: string;
  executionMeta: {
    stageId: string;
    stageIndex: number;
    [key: string]: unknown;
  };
  requestId: string;
  stageId: string;
  stageIndex: number;
  timestamp: string;
};

export type ToolCallWire = {
  function?: {
    arguments?: unknown;
    name?: string;
  };
  id?: string;
  type?: string;
};

export type CreateToolCallsPayload = {
  requestId: string;
  timestamp: string;
  toolCalls: ToolCallWire[];
};

export type CreateModelResponsePayload = {
  chatMessages?: SessionChatMessagePayload[];
  cost?: number;
  durationMs?: number;
  model: string;
  requestId: string;
  response?: {
    durationMs?: number;
    reasoning: string | null;
    reply: string | null;
    toolCalls?: ToolCallWire[];
  };
  thinkingMode: boolean;
  timestamp: string;
  usage: {
    cacheHitTokens: number;
    cacheMissTokens: number;
    completionTokens: number;
    reasoningTokens: number;
  };
};

export type PatchStageRuntimeSnapshotPayload = {
  contextAfter?: unknown;
  contextBefore?: unknown;
  requestId?: string;
  timestamp?: string;
};

export type SessionForkLineagePayload = {
  sourceRequestId: string;
  sourceSessionId: string;
  stageIndex: number;
};

export type LegacySessionEventWire = {
  contextAfter?: unknown;
  contextAfterTruncated?: boolean;
  contextBefore?: unknown;
  contextBeforeTruncated?: boolean;
  cost?: number;
  currentStage?: string;
  executionMeta?: unknown;
  model: string;
  requestId: string;
  response?: {
    durationMs: number;
    reasoning: string | null;
    reply: string | null;
    toolCalls?: unknown[];
  };
  sessionId: string;
  stageChat?: unknown[];
  stageIndex?: number;
  stageInput?: unknown;
  stageInputTruncated?: boolean;
  thinkingMode: boolean;
  timestamp: string;
  usage: {
    cacheHitTokens: number;
    cacheMissTokens: number;
    completionTokens: number;
    reasoningTokens: number;
  };
};

export type RerunPrefixSnapshotWire = {
  contextAfter?: unknown;
  contextAfterTruncated?: boolean;
  contextBefore?: unknown;
  contextBeforeTruncated?: boolean;
  currentStage?: string;
  executionMeta?: unknown;
  stageIndex: number;
};

export type SessionForkedFromWire = {
  prefixDump?: LegacySessionEventWire[];
  prefixSnapshots: RerunPrefixSnapshotWire[];
  requestId: string;
  sourceSessionId: string;
  stepIndex: number;
};

export type FinalizeSessionPayload = {
  result?: unknown;
  stages?: ParsedStageWire[];
};

export type RegisterSessionPayload = {
  forkLineage?: SessionForkLineagePayload;
  taskYahlPath: string;
};

export type RerunRequestPayload = {
  requestSnapshotOverride: {
    context: Record<string, unknown>;
    currentStage: string;
  };
  sourceRequestId: string;
  sourceSessionId: string;
  sourceStageId: string;
};

export type ForkrunFormWire = {
  _id: string;
  anchorStageIndex: number;
  requestSnapshotOverride: {
    context: {
      context: Record<string, unknown>;
      stage: Record<string, unknown>;
      types: Record<string, unknown>;
    };
    currentStage: string;
  };
  sourceRequestId: string;
  sourceSessionId: string;
  sourceStageId: string;
};
