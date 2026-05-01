export type SessionListItem = {
  archivedAt: string | null;
  createdAt: string;
  finalizedAt: string | null;
  sessionId: string;
  taskYahlPath: string | null;
  totalCalls: number;
  totalCost: number;
  totalUsedTimeMs: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  updatedAt: string;
};

export type SessionStepEvent = {
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

export type SessionForkedFrom = {
  prefixDump: SessionStepEvent[];
  requestId: string;
  sourceSessionId: string;
  stepIndex: number;
};

export type SessionDetail = {
  createdAt: string;
  events: SessionStepEvent[];
  finalizedAt?: string;
  forkedFrom?: SessionForkedFrom;
  modelAggregates: Record<string, {
    cacheHitTokens: number;
    cacheMissTokens: number;
    calls: number;
    completionTokens: number;
    cost: number;
    reasoningTokens: number;
  }>;
  result?: unknown;
  sessionId: string;
  taskYahlPath?: string | null;
  updatedAt: string;
};

export type SessionMetaSse = {
  finalizedAt: string | null;
  sessionId: string;
  taskYahlPath: string | null;
};

export type SessionStepSse = {
  cost: number;
  durationMs: number | null;
  executionMeta?: unknown;
  model: string;
  requestId?: string;
  replyPreview: string | null;
  sessionId: string;
  stageInput?: unknown;
  stageInputTruncated?: boolean;
  stepIndex: number;
  usage: {
    cacheHitTokens: number;
    cacheMissTokens: number;
    completionTokens: number;
    reasoningTokens: number;
  };
};

export type SessionsLifecycleSse = {
  eventType: "archived" | "created" | "deleted" | "finalized" | "updated";
  finalizedAt: string | null;
  sessionId: string;
  taskYahlPath: string | null;
  updatedAt: string | null;
};

export type RuntimeTask = {
  id: string;
  label: string;
  taskPath: string;
};

export type RuntimeRun = {
  createdAt: string;
  runId: string;
  sessionId: string;
  status: "completed" | "failed" | "running";
  taskId: string;
};

export type RuntimeRunLogEvent = {
  line: string;
  ts: string;
};

export type RuntimeRunMetaSse = {
  createdAt: string;
  runId: string;
  sessionId: string;
  status: "completed" | "failed" | "running";
  taskId: string;
};

export type RuntimeRunStatusSse = {
  exitCode: number | null;
  status: "completed" | "failed" | "running";
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
