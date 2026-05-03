import mongoose, { Schema } from "mongoose";

export type SessionDoc = {
  archivedAt?: Date | null;
  finalizedAt?: Date | null;
  result?: unknown;
  sessionId: string;
  taskYahlPath?: string;

  stages: {
    lines: string;
    sourceStartLine: number;
    type: "loop" | "plain";
  }[];
};

const sessionSchema = new Schema<SessionDoc>(
  {
    archivedAt: { type: Date },
    finalizedAt: { type: Date },
    result: { type: Schema.Types.Mixed },
    sessionId: { index: true, required: true, type: String, unique: true },
    taskYahlPath: { type: String },
    stages: [{
      lines: { type: String, required: true },
      sourceStartLine: { type: Number, required: true },
      type: { type: String, enum: ['loop', 'plain'], required: true },
    }],
  },
  { collection: "sessions", timestamps: true },
);

export const Session = mongoose.model<SessionDoc>("Session", sessionSchema);
