import type { IModelResponse, ISession, IStage, IToolCall } from './-types';

import type { Document } from 'mongoose';

import { model as createModel, Schema } from 'mongoose';

export type TDbSession = ISession & Document;
export type TDbStage = IStage & Document;
export type TDbModelResponse = IModelResponse & Document;
export type TDbToolCall = IToolCall & Document;

const tokenTotalsSchema = new Schema({
  cacheHitTokens: model.d.requiredNumber(),
  cacheMissTokens: model.d.requiredNumber(),
  completionTokens: model.d.requiredNumber(),
  promptTokens: model.d.requiredNumber(),
  reasoningTokens: model.d.requiredNumber(),
  totalTokens: model.d.requiredNumber(),
}, { _id: false });

const loopMetaSchema = new Schema({
  arraySnapshot: { type: [Schema.Types.Mixed], required: true },
  index: model.d.requiredNumber(),
  temperature: model.d.optionalNumber(),
  value: model.d.mixed(),
}, { _id: false });

const sessionSchema = new Schema<TDbSession>({
  deletedAt: model.d.deletedAt(),
  result: model.d.mixed(),
  sessionId: model.d.requiredString(),
  taskYahlPath: model.d.optionalString(),
  tokenTotals: tokenTotalsSchema,
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
  tokenTotals: tokenTotalsSchema,
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

export const modelSession = createModel<TDbSession>(modelsName.Sessions, sessionSchema);
export const modelStage = createModel<TDbStage>(modelsName.Stages, stageSchema);
export const modelModelResponse = createModel<TDbModelResponse>(
  modelsName.SessionModelResponses,
  modelResponseSchema,
);
export const modelToolCall = createModel<TDbToolCall>(modelsName.SessionToolCalls, toolCallSchema);
