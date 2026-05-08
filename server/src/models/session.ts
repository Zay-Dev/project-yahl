import mongoose, { Schema } from "mongoose";

export type SessionAskUserRecoveryDoc = {
  currentStageText: string;
  questionId: string;
  requestId: string;
  runtimeSnapshot: {
    context: Record<string, unknown>;
    stage: Record<string, unknown>;
    types: Record<string, unknown>;
  };
  sourceRef: {
    filePath: string;
    line: number;
  };
  stageId: string;
  timedOutAt: Date;
};

export type SessionDoc = {
  archivedAt?: Date | null;
  askUserRecovery?: SessionAskUserRecoveryDoc | null;
  finalizedAt?: Date | null;
  result?: unknown;
  resultA2ui?: unknown;
  sessionId: string;
  taskYahlPath?: string;
  title?: string | null;
  titleGeneratedAt?: Date | null;
  titleSource?: "auto" | "manual";

  stages: {
    lines: string;
    sourceStartLine: number;
    type: "loop" | "plain";
  }[];
};

const sessionSchema = new Schema<SessionDoc>(
  {
    archivedAt: { type: Date },
    askUserRecovery: {
      currentStageText: { required: true, type: String },
      questionId: { required: true, type: String },
      requestId: { required: true, type: String },
      runtimeSnapshot: {
        context: { default: {}, type: Schema.Types.Mixed },
        stage: { default: {}, type: Schema.Types.Mixed },
        types: { default: {}, type: Schema.Types.Mixed },
      },
      sourceRef: {
        filePath: { required: true, type: String },
        line: { required: true, type: Number },
      },
      stageId: { required: true, type: String },
      timedOutAt: { required: true, type: Date },
    },
    finalizedAt: { type: Date },
    result: { type: Schema.Types.Mixed },
    resultA2ui: { type: Schema.Types.Mixed },
    sessionId: { index: true, required: true, type: String, unique: true },
    taskYahlPath: { type: String },
    title: { type: String },
    titleGeneratedAt: { type: Date },
    titleSource: { enum: ["auto", "manual"], type: String },
    stages: [{
      lines: { type: String, required: true },
      sourceStartLine: { type: Number, required: true },
      type: { type: String, enum: ['loop', 'plain'], required: true },
    }],
  },
  { collection: "sessions", timestamps: true },
);

export const Session = mongoose.model<SessionDoc>("Session", sessionSchema);
