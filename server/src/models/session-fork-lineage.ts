import mongoose, { Schema } from "mongoose";

export type SessionForkLineageDoc = {
  sessionId: string;
  sourceRequestId: string;
  sourceSessionId: string;
  stageIndex: number;
};

const sessionForkLineageSchema = new Schema<SessionForkLineageDoc>(
  {
    sessionId: { index: true, required: true, type: String, unique: true },
    sourceRequestId: { required: true, type: String },
    sourceSessionId: { required: true, type: String },
    stageIndex: { required: true, type: Number },
  },
  { collection: "session_fork_lineages", timestamps: true },
);

export const SessionForkLineage = mongoose.model<SessionForkLineageDoc>(
  "SessionForkLineage",
  sessionForkLineageSchema,
);
