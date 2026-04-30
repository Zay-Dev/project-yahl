export type SessionListItem = {
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

export type SessionDetail = {
  createdAt: string;
  events: SessionStepEvent[];
  finalizedAt?: string;
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
  eventType: "created" | "finalized" | "updated";
  finalizedAt: string | null;
  sessionId: string;
  taskYahlPath: string | null;
  updatedAt: string | null;
};
