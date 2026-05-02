import mongoose, { Schema } from "mongoose";

export type SessionToolCallDoc = {
  arguments?: unknown;
  callIndex: number;
  externalToolCallId?: string;
  name: string;
  result?: unknown;
  sessionId: string;
  stageIndex: number;
  status: string;
};

const sessionToolCallSchema = new Schema<SessionToolCallDoc>(
  {
    arguments: { type: Schema.Types.Mixed },
    callIndex: { required: true, type: Number },
    externalToolCallId: { type: String },
    name: { required: true, type: String },
    result: { type: Schema.Types.Mixed },
    sessionId: { index: true, required: true, type: String },
    stageIndex: { required: true, type: Number },
    status: { default: "ok", type: String },
  },
  { collection: "session_tool_calls", timestamps: true },
);

sessionToolCallSchema.index({ sessionId: 1, stageIndex: 1, callIndex: 1 }, { unique: true });

export const SessionToolCall = mongoose.model<SessionToolCallDoc>("SessionToolCall", sessionToolCallSchema);
