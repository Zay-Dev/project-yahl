import mongoose, { Schema, Types } from "mongoose";

export type SessionToolCallDoc = {
  arguments?: unknown;
  callIndex: number;
  externalToolCallId?: string;
  name: string;
  result?: unknown;
  session: Types.ObjectId;
  sessionId: string;
  stage: Types.ObjectId;
  stageId: string;
  status: string;
};

const sessionToolCallSchema = new Schema<SessionToolCallDoc>(
  {
    arguments: { type: Schema.Types.Mixed },
    callIndex: { required: true, type: Number },
    externalToolCallId: { type: String },
    name: { required: true, type: String },
    result: { type: Schema.Types.Mixed },
    session: { ref: "Session", required: true, type: Schema.Types.ObjectId },
    sessionId: { index: true, required: true, type: String },
    stage: { ref: "SessionStage", required: true, type: Schema.Types.ObjectId },
    stageId: { required: true, type: String },
    status: { default: "ok", type: String },
  },
  { collection: "session_tool_calls", timestamps: true },
);

sessionToolCallSchema.index({ sessionId: 1, stageId: 1, callIndex: 1 }, { unique: true });
sessionToolCallSchema.index({ stage: 1 });

export const SessionToolCall = mongoose.model<SessionToolCallDoc>("SessionToolCall", sessionToolCallSchema);
