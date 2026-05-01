export type SessionUsagePayload = {
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
  prefixDump: SessionUsagePayload[];
  requestId: string;
  sourceSessionId: string;
  stepIndex: number;
};

export type FinalizeSessionPayload = {
  result?: unknown;
};

export type RegisterSessionPayload = {
  forkedFrom?: SessionForkedFrom;
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
