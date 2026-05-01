import mongoose, { Schema } from "mongoose";

import type { SessionForkedFrom, SessionUsagePayload } from "./types";

type ModelAggregate = {
  cacheHitTokens: number;
  cacheMissTokens: number;
  calls: number;
  completionTokens: number;
  cost: number;
  reasoningTokens: number;
};

type SessionRecord = {
  archivedAt?: Date | null;
  createdAt: Date;
  events: SessionUsagePayload[];
  finalizedAt?: Date;
  forkedFrom?: SessionForkedFrom;
  modelAggregates: Record<string, ModelAggregate>;
  result?: unknown;
  sessionId: string;
  taskYahlPath?: string;
  updatedAt: Date;
};

const modelAggregateSchema = new Schema<ModelAggregate>(
  {
    cacheHitTokens: { default: 0, required: true, type: Number },
    cacheMissTokens: { default: 0, required: true, type: Number },
    calls: { default: 0, required: true, type: Number },
    completionTokens: { default: 0, required: true, type: Number },
    cost: { default: 0, required: true, type: Number },
    reasoningTokens: { default: 0, required: true, type: Number },
  },
  { _id: false },
);

const sessionEventSchema = new Schema<SessionUsagePayload>(
  {
    cost: { type: Number },
    executionMeta: { type: Schema.Types.Mixed },
    model: { required: true, type: String },
    requestId: { required: true, type: String },
    response: {
      durationMs: Number,
      reasoning: { default: null, type: String },
      reply: { default: null, type: String },
      toolCalls: { type: [Schema.Types.Mixed] },
    },
    sessionId: { required: true, type: String },
    stageInput: { type: Schema.Types.Mixed },
    stageInputTruncated: { type: Boolean },
    thinkingMode: { required: true, type: Boolean },
    timestamp: { required: true, type: String },
    usage: {
      cacheHitTokens: { required: true, type: Number },
      cacheMissTokens: { required: true, type: Number },
      completionTokens: { required: true, type: Number },
      reasoningTokens: { required: true, type: Number },
    },
  },
  { _id: false },
);

const sessionSchema = new Schema<SessionRecord>(
  {
    archivedAt: { type: Date },
    events: { default: [], type: [sessionEventSchema] },
    finalizedAt: { type: Date },
    forkedFrom: { type: Schema.Types.Mixed },
    modelAggregates: {
      default: {},
      of: modelAggregateSchema,
      type: Map,
    },
    result: { type: Schema.Types.Mixed },
    sessionId: { index: true, required: true, type: String, unique: true },
    taskYahlPath: { type: String },
  },
  { timestamps: true },
);

export const SessionModel = mongoose.model("Session", sessionSchema);
