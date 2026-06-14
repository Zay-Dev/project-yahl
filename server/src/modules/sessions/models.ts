import type {
  IAskUserQuestion,
  IForkSession,
  IModelResponse,
  ISession,
  IStage,
  IToolCall,
} from './-types';

import type { Document } from 'mongoose';

import { model as createModel, Schema } from 'mongoose';

export type TDbSession = ISession & Document;
export type TDbStage = IStage & Document;
export type TDbModelResponse = IModelResponse & Document;
export type TDbToolCall = IToolCall & Document;
export type TDbAskUserQuestion = IAskUserQuestion & Document;

const loopMetaSchema = new Schema({
  arraySnapshot: { type: [Schema.Types.Mixed], required: true },
  endAfter: model.d.optionalNumber(),
  index: model.d.requiredNumber(),
  indexName: model.d.optionalString(),
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

const forkSessionSetupSchema = new Schema({
  context: model.d.mixed(),
  loopMeta: loopMetaSchema,
  stage: model.d.mixed(),
  stageId: model.d.requiredString(),
}, { _id: false });

const sessionSchema = new Schema<TDbSession>({
  deletedAt: model.d.deletedAt(),
  forkedFrom: forkedFromSchema,
  parsedStages: [model.d.mixed()],
  result: model.d.mixed(),
  resultContextKey: model.d.optionalString(),
  sessionId: model.d.requiredString(),
  taskId: model.d.optionalString(),
  taskYahlPath: model.d.optionalString(),
}, {
  collection: modelsName.Sessions,
  timestamps: true,
});

sessionSchema.index({ sessionId: 1 }, { unique: true });

const stageSchema = new Schema<TDbStage>({
  context: model.d.mixed(),
  contextAfter: model.d.mixed(),
  stage: model.d.mixed(),
  finishedAt: model.d.optionalDate(),
  loopMeta: loopMetaSchema,
  requestId: model.d.requiredString(),
  session: model.d.toRequiredObjectId(modelsName.Sessions),
  temperature: model.d.optionalNumber(),
}, {
  collection: modelsName.Stages,
  timestamps: true,
});

stageSchema.index({ requestId: 1, session: 1 }, { unique: true });

const modelResponseSchema = new Schema<TDbModelResponse>({
  durationMs: model.d.optionalNumber(),
  requestId: model.d.requiredString(),
  response: model.d.mixed(),
  session: model.d.toRequiredObjectId(modelsName.Sessions),
  thinkingMode: model.d.optionalBoolean(),
}, {
  collection: modelsName.SessionModelResponses,
  timestamps: true,
});

modelResponseSchema.index({ requestId: 1, session: 1 });

const toolCallSchema = new Schema<TDbToolCall>({
  requestId: model.d.requiredString(),
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
  setups: [forkSessionSetupSchema],
  sourceSessionId: model.d.requiredString(),
  targetSessionId: model.d.requiredString(),
}, {
  collection: modelsName.ForkSessions,
  timestamps: true,
});

forkSessionSchema.index({ forkSessionId: 1 }, { unique: true });

const askUserQuestionSchema = new Schema<TDbAskUserQuestion>({
  answerIds: [model.d.optionalString()],
  answerLabels: [model.d.optionalString()],
  answeredAt: model.d.optionalDate(),
  askUserId: model.d.mixed(),
  contextSnapshot: model.d.mixed(),
  forkSetupIndex: model.d.optionalNumber(),
  freeText: model.d.optionalString(),
  loopMeta: loopMetaSchema,
  question: model.d.mixed(),
  questionId: model.d.requiredString(),
  parsedStageSnapshot: model.d.mixed(),
  questionRef: model.d.requiredString(),
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
askUserQuestionSchema.index({ requestId: 1, session: 1 });
askUserQuestionSchema.index({ session: 1, status: 1 });

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
