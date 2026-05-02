export type SessionChatMessagePayload = {
  content?: unknown;
  role: string;
  toolCallIndex?: number;
  usageDelta?: unknown;
};

export type SessionRuntimeSnapshotPatchPayload = {
  contextAfter?: unknown;
  contextBefore?: unknown;
  requestId: string;
  runtimeSnapshotPatch: true;
  sessionId: string;
  timestamp: string;
};

export type SessionUsagePayload = {
  chatMessages?: SessionChatMessagePayload[];
  contextAfter?: unknown;
  contextAfterTruncated?: boolean;
  contextBefore?: unknown;
  contextBeforeTruncated?: boolean;
  cost?: number;
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

export type SessionForkLineagePayload = {
  sourceRequestId: string;
  sourceSessionId: string;
  stageIndex: number;
};

export type SessionForkedFromWire = {
  prefixDump: SessionUsagePayload[];
  requestId: string;
  sourceSessionId: string;
  stepIndex: number;
};

export type FinalizeSessionPayload = {
  result?: unknown;
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
  resumeFromStepIndex: number;
  sourceRequestId: string;
  sourceSessionId: string;
};
