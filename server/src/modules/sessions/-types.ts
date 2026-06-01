import type { TSoftDeletable, TWithTimestamps } from '@/core';

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

export interface ISession extends TSoftDeletable, TWithTimestamps {
  _id: string;
  sessionId: string;
  result?: unknown;
  taskYahlPath?: string;
  tokenTotals?: TTokenTotals;
}

export interface IStage extends TWithTimestamps {
  _id: string;
  session: string;
  requestId: string;
  context: Record<string, unknown>;
  contextAfter?: Record<string, unknown>;
  currentStage: string;
  finishedAt?: Date;
  loopMeta?: TStageLoopMeta;
  temperature?: number;
  tokenTotals?: TTokenTotals;
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
