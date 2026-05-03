import mongoose, { Schema, Types } from "mongoose";

export type SessionModelSpendDoc = {
  cacheHitTokens: number;
  cacheMissTokens: number;
  completionTokens: number;
  cost: number;
  durationMs?: number;
  model: string;
  reasoningTokens: number;
  requestId: string;
  session: Types.ObjectId;
  sessionId: string;
  stage: Types.ObjectId;
  stageId: string;
};

const sessionModelSpendSchema = new Schema<SessionModelSpendDoc>(
  {
    cacheHitTokens: { default: 0, required: true, type: Number },
    cacheMissTokens: { default: 0, required: true, type: Number },
    completionTokens: { default: 0, required: true, type: Number },
    cost: { default: 0, required: true, type: Number },
    durationMs: { type: Number },
    model: { required: true, type: String },
    reasoningTokens: { default: 0, required: true, type: Number },
    requestId: { required: true, type: String },
    session: { ref: "Session", required: true, type: Schema.Types.ObjectId },
    sessionId: { index: true, required: true, type: String },
    stage: { ref: "SessionStage", required: true, type: Schema.Types.ObjectId },
    stageId: { required: true, type: String },
  },
  { collection: "session_model_spends", timestamps: true },
);

sessionModelSpendSchema.index({ sessionId: 1, stageId: 1 });
sessionModelSpendSchema.index({ sessionId: 1, model: 1 });
sessionModelSpendSchema.index({ stage: 1 });

export const SessionModelSpend = mongoose.model<SessionModelSpendDoc>(
  "SessionModelSpend",
  sessionModelSpendSchema,
);
