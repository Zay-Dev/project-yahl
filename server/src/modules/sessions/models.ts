import type {
  IAskUserQuestion,
  IForkSession,
  IModelResponse,
  ISession,
  IStage,
  IToolCall,
  IUserPauseCheckpoint,
  IVerifyCheckpoint,
} from './-types';

import type { Document, Types } from 'mongoose';

import { model as createModel, Schema } from 'mongoose';

type TSessionChildDb<T extends { _id: string; session: string }> =
  Omit<T, '_id' | 'session'> & Document & {
    _id: Types.ObjectId;
    session: Types.ObjectId;
  };

export type TDbSession = ISession & Document;
export type TDbStage = TSessionChildDb<IStage>;
export type TDbModelResponse = TSessionChildDb<IModelResponse>;
export type TDbToolCall = TSessionChildDb<IToolCall>;
export type TDbAskUserQuestion = TSessionChildDb<IAskUserQuestion>;
export type TDbVerifyCheckpoint = TSessionChildDb<IVerifyCheckpoint>;
export type TDbUserPauseCheckpoint = TSessionChildDb<IUserPauseCheckpoint>;

const loopMetaSchema = new Schema({
  arraySnapshot: { type: [Schema.Types.Mixed] },
  endAfter: model.d.optionalNumber(),
  index: model.d.optionalNumber(),
  indexName: model.d.optionalString(),
  kind: { enum: ['for', 'warmup', 'while'], type: String },
  remainingBashCalls: model.d.optionalNumber(),
  remainingTurns: model.d.optionalNumber(),
  startAt: model.d.optionalNumber(),
  step: model.d.optionalNumber(),
  temperature: model.d.optionalNumber(),
  value: model.d.mixed(),
}, { _id: false });

const forkedFromSchema = new Schema({
  anchorStageId: model.d.requiredString(),
  forkSessionId: model.d.requiredString(),
  sourceSessionId: model.d.requiredString(),
}, { _id: false });

const runCursorSchema = new Schema({
  kind: { default: 'pipeline', enum: ['pipeline', 'repair'], required: true, type: String },
  loopMeta: loopMetaSchema,
  repairInstruction: model.d.optionalString(),
  stageIndex: model.d.requiredNumber(),
}, { _id: false });

const forkSessionSetupSchema = new Schema({
  context: model.d.mixed(),
  loopMeta: loopMetaSchema,
  parsedStageIndex: model.d.optionalNumber(),
  stage: model.d.mixed(),
  stageId: model.d.requiredString(),
}, { _id: false });

const sessionSchema = new Schema<TDbSession>({
  deletedAt: model.d.deletedAt(),
  forkedFrom: forkedFromSchema,
  isBackground: { default: false, type: Boolean },
  liveViewVncPort: model.d.optionalNumber(),
  parsedStages: [model.d.mixed()],
  result: model.d.mixed(),
  resultContextKey: model.d.optionalString(),
  runCursor: runCursorSchema,
  runInput: model.d.mixed(),
  sessionId: model.d.requiredString(),
  storageSeed: model.d.mixed(),
  taskId: model.d.optionalString(),
  taskSkills: [model.d.mixed()],
  taskYahl: model.d.optionalString(),
}, {
  collection: modelsName.Sessions,
  timestamps: true,
});

sessionSchema.index({ sessionId: 1 }, { unique: true });
sessionSchema.index({ 'forkedFrom.sourceSessionId': 1 });

const stageSchema = new Schema<TDbStage>({
  context: model.d.mixed(),
  contextAfter: model.d.mixed(),
  parsedStageIndex: model.d.optionalNumber(),
  sourceStartLine: model.d.optionalNumber(),
  stage: model.d.mixed(),
  finishedAt: model.d.optionalDate(),
  loopMeta: loopMetaSchema,
  requestId: model.d.requiredString(),
  session: model.d.toRequiredObjectId(modelsName.Sessions),
  temperature: model.d.optionalNumber(),
  verifyingAt: model.d.optionalDate(),
  verifyResult: model.d.mixed(),
}, {
  collection: modelsName.Stages,
  timestamps: true,
});

stageSchema.index({ requestId: 1, session: 1 }, { unique: true });

const modelResponseSchema = new Schema<TDbModelResponse>({
  domain: model.d.optionalString(),
  durationMs: model.d.optionalNumber(),
  requestId: model.d.requiredString(),
  response: model.d.mixed(),
  session: model.d.toRequiredObjectId(modelsName.Sessions),
  tags: [model.d.optionalString()],
  thinkingMode: model.d.optionalBoolean(),
}, {
  collection: modelsName.SessionModelResponses,
  timestamps: true,
});

modelResponseSchema.index({ requestId: 1, session: 1 });

const toolCallSchema = new Schema<TDbToolCall>({
  requestId: model.d.requiredString(),
  results: [model.d.mixed()],
  session: model.d.toRequiredObjectId(modelsName.Sessions),
  toolCalls: [model.d.mixed()],
}, {
  collection: modelsName.SessionToolCalls,
  timestamps: true,
});

toolCallSchema.index({ requestId: 1, session: 1 });

const forkSessionSchema = new Schema<IForkSession & Document>({
  anchorStageId: model.d.requiredString(),
  forkSessionId: model.d.requiredString(),
  repairInstruction: model.d.optionalString(),
  setups: [forkSessionSetupSchema],
  sourceSessionId: model.d.requiredString(),
  targetSessionId: model.d.requiredString(),
}, {
  collection: modelsName.ForkSessions,
  timestamps: true,
});

forkSessionSchema.index({ forkSessionId: 1 }, { unique: true });

const askUserBatchAnswerSchema = new Schema({
  answerValue: model.d.mixed(),
  freeText: model.d.optionalString(),
  optionIds: [model.d.optionalString()],
  questionRef: model.d.requiredString(),
}, { _id: false });

const askUserQuestionSchema = new Schema<TDbAskUserQuestion>({
  batch: model.d.mixed(),
  batchAnswers: [askUserBatchAnswerSchema],
  batchId: model.d.optionalString(),
  contextSnapshot: model.d.mixed(),
  forkSetupIndex: model.d.optionalNumber(),
  loopMeta: loopMetaSchema,
  parsedStageSnapshot: model.d.mixed(),
  questionId: model.d.requiredString(),
  requestId: model.d.requiredString(),
  session: model.d.toRequiredObjectId(modelsName.Sessions),
  stage: model.d.mixed(),
  stageIndex: model.d.optionalNumber(),
  status: model.d.requiredString(),
  storageSnapshot: model.d.mixed(),
  toolCallId: model.d.requiredString(),
}, {
  collection: modelsName.SessionAskUserQuestions,
  timestamps: true,
});

askUserQuestionSchema.index({ questionId: 1 }, { unique: true });
askUserQuestionSchema.index({ batchId: 1, session: 1 });
askUserQuestionSchema.index({ session: 1, status: 1 });

const verifyCheckpointSchema = new Schema<TDbVerifyCheckpoint>({
  askUserQuestion: model.d.mixed(),
  askUserRef: model.d.optionalString(),
  contextSnapshot: model.d.mixed(),
  editedAnswerFreeText: model.d.optionalString(),
  editedAnswerOptionIds: [model.d.optionalString()],
  feedback: model.d.requiredString(),
  forkSetupIndex: model.d.optionalNumber(),
  kind: model.d.optionalString(),
  loopMeta: loopMetaSchema,
  parsedStageSnapshot: model.d.mixed(),
  requestId: model.d.requiredString(),
  resumeAction: model.d.optionalString(),
  score: model.d.requiredNumber(),
  session: model.d.toRequiredObjectId(modelsName.Sessions),
  stage: model.d.mixed(),
  stageIndex: model.d.optionalNumber(),
  status: model.d.requiredString(),
  storageSnapshot: model.d.mixed(),
  unavailable: model.d.optionalBoolean(),
  verifyId: model.d.requiredString(),
}, {
  collection: modelsName.SessionVerifyCheckpoints,
  timestamps: true,
});

verifyCheckpointSchema.index({ verifyId: 1 }, { unique: true });
verifyCheckpointSchema.index({ requestId: 1, session: 1 });
verifyCheckpointSchema.index({ session: 1, status: 1 });

const userPauseCheckpointSchema = new Schema<TDbUserPauseCheckpoint>({
  contextSnapshot: model.d.mixed(),
  loopMeta: loopMetaSchema,
  parsedStageSnapshot: model.d.mixed(),
  pauseId: model.d.requiredString(),
  repairInstruction: model.d.optionalString(),
  requestId: model.d.requiredString(),
  session: model.d.toRequiredObjectId(modelsName.Sessions),
  stage: model.d.mixed(),
  stageIndex: model.d.optionalNumber(),
  status: model.d.requiredString(),
  storageSnapshot: model.d.mixed(),
}, {
  collection: modelsName.SessionUserPauseCheckpoints,
  timestamps: true,
});

userPauseCheckpointSchema.index({ pauseId: 1 }, { unique: true });
userPauseCheckpointSchema.index({ requestId: 1, session: 1 });
userPauseCheckpointSchema.index({ session: 1, status: 1 });

export type TDbForkSession = IForkSession & Document;

export const modelForkSession = createModel<TDbForkSession>(
  modelsName.ForkSessions,
  forkSessionSchema,
);
export const modelSession = createModel<TDbSession>(modelsName.Sessions, sessionSchema);
export const modelStage = createModel<TDbStage>(modelsName.Stages, stageSchema);
export const modelModelResponse = createModel<TDbModelResponse>(
  modelsName.SessionModelResponses,
  modelResponseSchema,
);
export const modelToolCall = createModel<TDbToolCall>(modelsName.SessionToolCalls, toolCallSchema);
export const modelAskUserQuestion = createModel<TDbAskUserQuestion>(
  modelsName.SessionAskUserQuestions,
  askUserQuestionSchema,
);
export const modelVerifyCheckpoint = createModel<TDbVerifyCheckpoint>(
  modelsName.SessionVerifyCheckpoints,
  verifyCheckpointSchema,
);
export const modelUserPauseCheckpoint = createModel<TDbUserPauseCheckpoint>(
  modelsName.SessionUserPauseCheckpoints,
  userPauseCheckpointSchema,
);
