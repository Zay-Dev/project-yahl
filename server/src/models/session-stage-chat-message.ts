import mongoose, { Schema, Types } from "mongoose";

export type SessionStageChatMessageDoc = {
  content?: unknown;
  modelSpendId?: Types.ObjectId;
  role: string;
  sequence: number;
  session: Types.ObjectId;
  sessionId: string;
  stage: Types.ObjectId;
  stageId: string;
  toolCallId?: Types.ObjectId;
  usageDelta?: unknown;
};

const sessionStageChatMessageSchema = new Schema<SessionStageChatMessageDoc>(
  {
    content: { type: Schema.Types.Mixed },
    modelSpendId: { ref: "SessionModelSpend", type: Schema.Types.ObjectId },
    role: { required: true, type: String },
    sequence: { required: true, type: Number },
    session: { ref: "Session", required: true, type: Schema.Types.ObjectId },
    sessionId: { index: true, required: true, type: String },
    stage: { ref: "SessionStage", required: true, type: Schema.Types.ObjectId },
    stageId: { required: true, type: String },
    toolCallId: { ref: "SessionToolCall", type: Schema.Types.ObjectId },
    usageDelta: { type: Schema.Types.Mixed },
  },
  { collection: "session_stage_chat_messages", timestamps: true },
);

sessionStageChatMessageSchema.index({ sessionId: 1, stageId: 1, sequence: 1 }, { unique: true });
sessionStageChatMessageSchema.index({ stage: 1 });
sessionStageChatMessageSchema.index({ toolCallId: 1 });
sessionStageChatMessageSchema.index({ modelSpendId: 1 });

export const SessionStageChatMessage = mongoose.model<SessionStageChatMessageDoc>(
  "SessionStageChatMessage",
  sessionStageChatMessageSchema,
);
