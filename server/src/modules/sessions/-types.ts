import type { TSoftDeletable, TWithTimestamps } from '@omni-infra/types/entities';

export type TTokenTotals = {
  cacheHitTokens: number;
  cacheMissTokens: number;
  completionTokens: number;
  promptTokens: number;
  reasoningTokens: number;
  totalTokens: number;
};

export type TStageLoopMeta = {
  arraySnapshot: unknown[];
  endAfter?: number;
  index: number;
  indexName?: string;
  startAt?: number;
  step?: number;
  temperature?: number;
  value: unknown;
};

export type TYahlAskUserOption = {
  description?: string;
  id: string;
  label: string;
};

export type TYahlAskUserEntry = {
  answer?: number | string;
  id: number | string;
  options?: TYahlAskUserOption[];
  question: string;
};

export type TYahlStage = {
  askUser?: TYahlAskUserEntry[];
  conditionMode?: boolean;
  contextKeys?: string[];
  contextMode?: boolean;
  logic: string;
  loopSetup?: string;
  produceContextKeys?: string[];
  produceTypeKeys?: string[];
  temperature?: number;
  updateContextKeys?: string[];
};

export type TParsedStage = {
  contextKeys?: string[];
  lines: string;
  produceContextKeys?: string[];
  produceTypeKeys?: string[];
  sourceStartLine: number;
  spec: TYahlStage;
  temperature?: number;
  type: 'loop' | 'plain';
  updateContextKeys?: string[];
};

export type TSessionForkedFrom = {
  anchorStageId: string;
  forkSessionId: string;
  sourceSessionId: string;
};

export type TForkSessionStageSetup = {
  context: Record<string, unknown>;
  loopMeta?: TStageLoopMeta;
  stage: TYahlStage;
  stageId: string;
};

export interface IForkSession extends TWithTimestamps {
  _id: string;
  anchorStageId: string;
  forkSessionId: string;
  setups: TForkSessionStageSetup[];
  sourceSessionId: string;
  targetSessionId: string;
}

export interface ISession extends TSoftDeletable, TWithTimestamps {
  _id: string;
  forkedFrom?: TSessionForkedFrom;
  parsedStages?: TParsedStage[];
  sessionId: string;
  result?: unknown;
  taskId?: string;
  taskYahlPath?: string;
}

export interface IStage extends TWithTimestamps {
  _id: string;
  session: string;
  requestId: string;
  context: Record<string, unknown>;
  contextAfter?: Record<string, unknown>;
  finishedAt?: Date;
  stage: TYahlStage;
  loopMeta?: TStageLoopMeta;
  temperature?: number;
}

export interface IModelResponse extends TWithTimestamps {
  _id: string;
  session: string;
  requestId: string;
  durationMs?: number;
  response: Record<string, unknown>;
  thinkingMode?: boolean;
}

export interface IToolCall extends TWithTimestamps {
  _id: string;
  session: string;
  requestId: string;
  toolCalls: Record<string, unknown>[];
}

export type TAskUserQuestionStatus = 'answered' | 'pending';

export type TParsedStageSnapshot = {
  lines: string;
  sourceStartLine: number;
  type: 'loop' | 'plain';
};

export interface IAskUserQuestion extends TWithTimestamps {
  _id: string;
  answerIds?: string[];
  answerLabels?: string[];
  answeredAt?: Date;
  askUserId: number | string;
  contextSnapshot: Record<string, unknown>;
  forkSetupIndex?: number;
  freeText?: string;
  loopMeta?: TStageLoopMeta;
  question: Record<string, unknown>;
  questionId: string;
  parsedStageSnapshot?: TParsedStageSnapshot;
  questionRef: string;
  requestId: string;
  session: string;
  stage: TYahlStage;
  stageIndex?: number;
  status: TAskUserQuestionStatus;
  storageSnapshot: Record<string, unknown>;
  toolCallId: string;
}
