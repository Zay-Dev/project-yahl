import mongoose, { Schema } from "mongoose";

export type LlmReplyEnvelopeSub = {
  durationMs?: number;
  reasoning: string | null;
  reply: string | null;
};

export type SessionStageDoc = {
  contextAfter?: unknown;
  contextAfterTruncated?: boolean;
  contextBefore?: unknown;
  contextBeforeTruncated?: boolean;
  cost?: number;
  executionMeta?: unknown;
  llmReplyEnvelope?: LlmReplyEnvelopeSub;
  model: string;
  requestId: string;
  sessionId: string;
  stageIndex: number;
  thinkingMode: boolean;
  timestamp: string;
  usage: {
    cacheHitTokens: number;
    cacheMissTokens: number;
    completionTokens: number;
    reasoningTokens: number;
  };
};

const usageSub = new Schema(
  {
    cacheHitTokens: { required: true, type: Number },
    cacheMissTokens: { required: true, type: Number },
    completionTokens: { required: true, type: Number },
    reasoningTokens: { required: true, type: Number },
  },
  { _id: false },
);

const llmReplySub = new Schema(
  {
    durationMs: { type: Number },
    reasoning: { default: null, type: String },
    reply: { default: null, type: String },
  },
  { _id: false },
);

const sessionStageSchema = new Schema<SessionStageDoc>(
  {
    contextAfter: { type: Schema.Types.Mixed },
    contextAfterTruncated: { type: Boolean },
    contextBefore: { type: Schema.Types.Mixed },
    contextBeforeTruncated: { type: Boolean },
    cost: { type: Number },
    executionMeta: { type: Schema.Types.Mixed },
    llmReplyEnvelope: { type: llmReplySub },
    model: { required: true, type: String },
    requestId: { required: true, type: String },
    sessionId: { index: true, required: true, type: String },
    stageIndex: { required: true, type: Number },
    thinkingMode: { required: true, type: Boolean },
    timestamp: { required: true, type: String },
    usage: { required: true, type: usageSub },
  },
  { collection: "session_stages", timestamps: true },
);

sessionStageSchema.index({ sessionId: 1, stageIndex: 1 }, { unique: true });
sessionStageSchema.index({ sessionId: 1, requestId: 1 });

export const SessionStage = mongoose.model<SessionStageDoc>("SessionStage", sessionStageSchema);
