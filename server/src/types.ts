export type SessionChatMessagePayload = {
  content?: unknown;
  reasoning?: string | null;
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
  stageChat?: {
    content?: unknown;
    modelSpendId?: string;
    reasoning?: string | null;
    role: string;
    toolCallId?: string;
  }[];
  stageIndex?: number;
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

export type UpdateSessionTitlePayload = {
  title: string;
};

export type AskUserOptionPayload = {
  description?: string;
  id: string;
  label: string;
};

export type AskUserMultipleChoicePayload = {
  allowMultiple?: boolean;
  description?: string;
  kind: "multipleChoice";
  maxChoices?: number;
  minChoices?: number;
  options: AskUserOptionPayload[];
  title: string;
  version: "askUser.v1";
};

export type CreateAskUserQuestionPayload = {
  question: AskUserMultipleChoicePayload;
  requestId: string;
  stageId: string;
};

export type AnswerAskUserQuestionPayload = {
  answerIds: string[];
};

export type AskUserTimedOutRecoveryPayload = {
  currentStageText: string;
  questionId: string;
  requestId: string;
  runtimeSnapshot: {
    context: Record<string, unknown>;
    stage: Record<string, unknown>;
    types: Record<string, unknown>;
  };
  sourceRef: {
    filePath: string;
    line: number;
  };
  stageId: string;
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
