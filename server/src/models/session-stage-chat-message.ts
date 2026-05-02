import mongoose, { Schema, Types } from "mongoose";

export type SessionStageChatMessageDoc = {
  content?: unknown;
  modelSpendId?: Types.ObjectId;
  role: string;
  sequence: number;
  sessionId: string;
  stageIndex: number;
  toolCallId?: Types.ObjectId;
  usageDelta?: unknown;
};

const sessionStageChatMessageSchema = new Schema<SessionStageChatMessageDoc>(
  {
    content: { type: Schema.Types.Mixed },
    modelSpendId: { ref: "SessionModelSpend", type: Schema.Types.ObjectId },
    role: { required: true, type: String },
    sequence: { required: true, type: Number },
    sessionId: { index: true, required: true, type: String },
    stageIndex: { required: true, type: Number },
    toolCallId: { ref: "SessionToolCall", type: Schema.Types.ObjectId },
    usageDelta: { type: Schema.Types.Mixed },
  },
  { collection: "session_stage_chat_messages", timestamps: true },
);

sessionStageChatMessageSchema.index({ sessionId: 1, stageIndex: 1, sequence: 1 }, { unique: true });
sessionStageChatMessageSchema.index({ toolCallId: 1 });
sessionStageChatMessageSchema.index({ modelSpendId: 1 });

export const SessionStageChatMessage = mongoose.model<SessionStageChatMessageDoc>(
  "SessionStageChatMessage",
  sessionStageChatMessageSchema,
);
