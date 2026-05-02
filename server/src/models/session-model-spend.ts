import mongoose, { Schema } from "mongoose";

export type SessionModelSpendDoc = {
  cacheHitTokens: number;
  cacheMissTokens: number;
  calls: number;
  completionTokens: number;
  cost: number;
  model: string;
  reasoningTokens: number;
  sessionId: string;
};

const sessionModelSpendSchema = new Schema<SessionModelSpendDoc>(
  {
    cacheHitTokens: { default: 0, required: true, type: Number },
    cacheMissTokens: { default: 0, required: true, type: Number },
    calls: { default: 0, required: true, type: Number },
    completionTokens: { default: 0, required: true, type: Number },
    cost: { default: 0, required: true, type: Number },
    model: { required: true, type: String },
    reasoningTokens: { default: 0, required: true, type: Number },
    sessionId: { index: true, required: true, type: String },
  },
  { collection: "session_model_spends", timestamps: true },
);

sessionModelSpendSchema.index({ sessionId: 1, model: 1 }, { unique: true });

export const SessionModelSpend = mongoose.model<SessionModelSpendDoc>(
  "SessionModelSpend",
  sessionModelSpendSchema,
);
