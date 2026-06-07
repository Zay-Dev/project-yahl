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

export type TYahlStage = {
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
