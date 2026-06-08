import type {
  TForkSessionStageSetup,
  TParsedStage,
  TSessionForkedFrom,
  TStageLoopMeta,
  TTokenTotals,
  TYahlStage,
} from './-types';

export type TResponseTokenTotals = TTokenTotals;

export type TResponseGetSession = {
  _id: string;
  createdAt: string;
  deletedAt?: string;
  forkedFrom?: TSessionForkedFrom;
  parsedStages?: TParsedStage[];
  result?: unknown;
  sessionId: string;
  taskId?: string;
  taskYahlPath?: string;
  tokenTotals: TResponseTokenTotals | null;
  updatedAt: string;
};

export type TResponseSessionListItem = {
  _id: string;
  createdAt: string;
  deletedAt?: string;
  sessionId: string;
  taskId?: string;
  taskYahlPath?: string;
  tokenTotals: TResponseTokenTotals | null;
  updatedAt: string;
};

export type TResponseStageStatus = 'finished' | 'running';

export type TResponseStageListItem = {
  createdAt: string;
  finishedAt?: string;
  logicPreview: string;
  loopSetup?: string;
  loopIndex?: number;
  loopValue?: unknown;
  modelCallCount: number;
  requestId: string;
  stageId: string;
  status: TResponseStageStatus;
  tokenTotals: TTokenTotals | null;
  toolCallCount: number;
  updatedAt: string;
};

export type TResponseStageReplayItem = {
  context: Record<string, unknown>;
  contextAfter?: Record<string, unknown>;
  finishedAt?: string;
  loopMeta?: TStageLoopMeta;
  requestId: string;
  stage: TYahlStage;
  stageId: string;
  temperature?: number;
};

export type TResponseStageModelResponseItem = {
  _id: string;
  contentPreview: string;
  createdAt: string;
  durationMs?: number;
  model?: string;
  response?: Record<string, unknown>;
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

export type TResponseAskUserQuestionListItem = {
  question: Record<string, unknown>;
  questionId: string;
  questionRef: string;
  requestId: string;
  status: 'answered' | 'pending';
};

export type TSessionLiveEvent =
  | { type: 'ask-user.answered'; questionId: string; requestId: string }
  | { type: 'ask-user.created'; questionId: string; requestId: string }
  | { type: 'session.updated' }
  | { type: 'stage.created'; requestId: string }
  | { type: 'stage.finished'; requestId: string }
  | { type: 'stage.model-response'; requestId: string }
  | { type: 'stage.tool-call'; requestId: string };

export type TStageListSource = {
  contextAfter?: Record<string, unknown>;
  context?: Record<string, unknown>;
  createdAt: Date | string;
  finishedAt?: Date | string;
  loopMeta?: TStageLoopMeta;
  requestId: string;
  stage: TYahlStage;
  temperature?: number;
  updatedAt: Date | string;
};

export type TResponseGetForkSession = {
  anchorStageId: string;
  forkSessionId: string;
  parsedStages?: TParsedStage[];
  setups: TForkSessionStageSetup[];
  sourceSessionId: string;
  targetSessionId: string;
  taskYahlPath?: string;
};

export type TRequestCreateForkSessionBody = {
  anchorStageId: string;
  setups: TForkSessionStageSetup[];
};

export type TResponseCreateForkSession = {
  forkSessionId: string;
  targetSessionId: string;
};

export type TResponseDeleteSession = {
  ok: true;
};
