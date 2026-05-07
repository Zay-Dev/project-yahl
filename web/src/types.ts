import type {
  LegacySessionEventWire,
  RerunRequestPayload as RerunRequestPayloadWire,
  SessionMetaSsePayload,
  SessionStepChatMessage,
  SessionStepSsePayload,
  SessionsLifecycleSsePayload,
} from "server/wire";

export type SessionStepEvent = LegacySessionEventWire;

export type SessionMetaSse = SessionMetaSsePayload;

export type SessionStepSse = SessionStepSsePayload;

export type SessionsLifecycleSse = SessionsLifecycleSsePayload;

export type RerunRequestPayload = RerunRequestPayloadWire;

export type SessionStageChatMessage = SessionStepChatMessage;

export type SessionListItem = {
  archivedAt: string | null;
  createdAt: string;
  finalizedAt: string | null;
  sessionId: string;
  taskYahlPath: string | null;
  title: string | null;
  titleSource: "auto" | "manual" | null;
  totalCalls: number;
  totalCost: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalUsedTimeMs: number;
  updatedAt: string;
};

export type SessionForkLineage = {
  sourceRequestId: string;
  sourceSessionId: string;
  stageIndex: number;
};

export type AskUserQuestion = {
  allowMultiple: boolean;
  answerIds: string[];
  answeredAt: string | null;
  description: string | null;
  maxChoices: number | null;
  minChoices: number | null;
  options: { description?: string | null; id: string; label: string }[];
  questionId: string;
  requestId: string;
  stageId: string;
  status: "answered" | "pending";
  title: string;
};

export type SessionDetail = {
  createdAt: string;
  events: SessionStepEvent[];
  finalizedAt?: string;
  forkLineage?: SessionForkLineage;
  modelAggregates: Record<string, {
    cacheHitTokens: number;
    cacheMissTokens: number;
    calls: number;
    completionTokens: number;
    cost: number;
    reasoningTokens: number;
  }>;
  result?: unknown;
  askUserQuestions?: AskUserQuestion[];
  sessionId: string;
  taskYahlPath?: string | null;
  title?: string | null;
  titleSource?: "auto" | "manual" | null;
  updatedAt: string;
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
