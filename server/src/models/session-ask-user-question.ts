import { Schema, Types, model } from "mongoose";

type AskUserOptionDoc = {
  description?: string | null;
  id: string;
  label: string;
};

export type SessionAskUserQuestionDoc = {
  answeredAt?: Date | null;
  answerIds?: string[];
  description?: string | null;
  maxChoices?: number | null;
  minChoices?: number | null;
  questionId: string;
  requestId: string;
  session: Types.ObjectId;
  sessionId: string;
  stageId: string;
  status: "answered" | "pending";
  title: string;
  allowMultiple: boolean;
  options: AskUserOptionDoc[];
};

const optionSchema = new Schema<AskUserOptionDoc>({
  description: { type: String },
  id: { required: true, type: String },
  label: { required: true, type: String },
}, { _id: false });

const sessionAskUserQuestionSchema = new Schema<SessionAskUserQuestionDoc>(
  {
    allowMultiple: { default: false, required: true, type: Boolean },
    answeredAt: { type: Date },
    answerIds: [{ type: String }],
    description: { type: String },
    maxChoices: { type: Number },
    minChoices: { type: Number },
    options: { required: true, type: [optionSchema] },
    questionId: { index: true, required: true, type: String },
    requestId: { required: true, type: String },
    session: { ref: "Session", required: true, type: Schema.Types.ObjectId },
    sessionId: { index: true, required: true, type: String },
    stageId: { required: true, type: String },
    status: { default: "pending", enum: ["answered", "pending"], required: true, type: String },
    title: { required: true, type: String },
  },
  { collection: "session_ask_user_questions", timestamps: true },
);

sessionAskUserQuestionSchema.index({ sessionId: 1, questionId: 1 }, { unique: true });
sessionAskUserQuestionSchema.index({ sessionId: 1, status: 1, createdAt: -1 });

export const SessionAskUserQuestion = model<SessionAskUserQuestionDoc>(
  "SessionAskUserQuestion",
  sessionAskUserQuestionSchema,
);
