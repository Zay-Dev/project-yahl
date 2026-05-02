import mongoose, { Schema } from "mongoose";

export type SessionDoc = {
  archivedAt?: Date | null;
  finalizedAt?: Date | null;
  result?: unknown;
  sessionId: string;
  taskYahlPath?: string;
};

const sessionSchema = new Schema<SessionDoc>(
  {
    archivedAt: { type: Date },
    finalizedAt: { type: Date },
    result: { type: Schema.Types.Mixed },
    sessionId: { index: true, required: true, type: String, unique: true },
    taskYahlPath: { type: String },
  },
  { collection: "sessions", timestamps: true },
);

export const Session = mongoose.model<SessionDoc>("Session", sessionSchema);
