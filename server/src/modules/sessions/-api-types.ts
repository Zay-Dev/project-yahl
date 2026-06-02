import type { TStageLoopMeta, TTokenTotals, TYahlStage } from './-types';

export type TResponseTokenTotals = TTokenTotals;

export type TResponseGetSession = {
  _id: string;
  createdAt: string;
  deletedAt?: string;
  result?: unknown;
  sessionId: string;
  taskYahlPath?: string;
  tokenTotals: TResponseTokenTotals | null;
  updatedAt: string;
};

export type TResponseSessionListItem = {
  _id: string;
  createdAt: string;
  deletedAt?: string;
  sessionId: string;
  taskYahlPath?: string;
  tokenTotals: TResponseTokenTotals | null;
  updatedAt: string;
};

export type TResponseStageStatus = 'finished' | 'running';

export type TResponseStageListItem = {
  createdAt: string;
  finishedAt?: string;
  logicPreview: string;
  loopIndex?: number;
  loopValue?: unknown;
  modelCallCount: number;
  requestId: string;
  status: TResponseStageStatus;
  tokenTotals: TTokenTotals | null;
  toolCallCount: number;
  updatedAt: string;
};

export type TResponseStageModelResponseItem = {
  _id: string;
  contentPreview: string;
  createdAt: string;
  durationMs?: number;
  model?: string;
  thinkingMode?: boolean;
  usage: TTokenTotals | null;
};

export type TResponseStageToolSummary = {
  arguments: unknown;
  id: string;
  name: string;
};

export type TResponseStageToolCallItem = {
  _id: string;
  createdAt: string;
  tools: TResponseStageToolSummary[];
};

export type TResponseStageDetail = TResponseStageListItem & {
  context: Record<string, unknown>;
  contextAfter?: Record<string, unknown>;
  loopMeta?: TStageLoopMeta;
  modelResponses: TResponseStageModelResponseItem[];
  stage: TYahlStage;
  toolCalls: TResponseStageToolCallItem[];
};

export type TSessionLiveEvent =
  | { type: 'session.updated' }
  | { type: 'stage.created'; requestId: string }
  | { type: 'stage.finished'; requestId: string }
  | { type: 'stage.model-response'; requestId: string }
  | { type: 'stage.tool-call'; requestId: string };

export type TStageListSource = {
  contextAfter?: Record<string, unknown>;
  createdAt: Date | string;
  finishedAt?: Date | string;
  loopMeta?: TStageLoopMeta;
  requestId: string;
  stage: TYahlStage;
  updatedAt: Date | string;
};
