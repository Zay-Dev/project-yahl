import Joi from "joi";

import type {
  AnswerAskUserQuestionPayload,
  AskUserTimedOutRecoveryPayload,
  CreateAskUserQuestionPayload,
  CreateModelResponsePayload,
  CreateStagePayload,
  CreateToolCallsPayload,
  FinalizeSessionPayload,
  PatchStageRuntimeSnapshotPayload,
  RegisterSessionPayload,
  RerunRequestPayload,
  UpdateSessionTitlePayload,
} from "../../../types";

const validateOpts = { abortEarly: false, stripUnknown: false } as const;

const passes = (schema: Joi.Schema, value: unknown) =>
  schema.validate(value, validateOpts).error === undefined;

const finiteNumber = () =>
  Joi.number().custom((v, helpers) => {
    if (typeof v !== "number" || !Number.isFinite(v)) return helpers.error("any.invalid");
    return v;
  });

const usageTokenShape = {
  cacheHitTokens: finiteNumber().required(),
  cacheMissTokens: finiteNumber().required(),
  completionTokens: finiteNumber().required(),
  reasoningTokens: finiteNumber().required(),
};

const chatMessageRowSchema = Joi.object({
  role: Joi.string().required(),
  toolCallIndex: Joi.number().integer().min(0).optional(),
}).unknown(true);

const executionMetaSchema = Joi.object({
  stageId: Joi.string().required(),
  stageIndex: Joi.number().integer().min(0).required(),
}).unknown(true);

const createStageBodySchema = Joi.object({
  contextBefore: Joi.any().optional(),
  contextBeforeTruncated: Joi.boolean().optional(),
  currentStage: Joi.string().required(),
  executionMeta: executionMetaSchema.required(),
  requestId: Joi.string().required(),
  stageId: Joi.string().required(),
  stageIndex: Joi.number().integer().min(0).required(),
  timestamp: Joi.string().required(),
}).unknown(true);

const toolCallWireSchema = Joi.object({
  function: Joi.object({
    arguments: Joi.any().optional(),
    name: Joi.string().optional(),
  }).unknown(true).optional(),
  id: Joi.string().optional(),
  type: Joi.string().optional(),
}).unknown(true);

const createToolCallsBodySchema = Joi.object({
  requestId: Joi.string().required(),
  timestamp: Joi.string().required(),
  toolCalls: Joi.array().items(toolCallWireSchema).required(),
}).unknown(true);

const createModelResponseBodySchema = Joi.object({
  chatMessages: Joi.array().items(chatMessageRowSchema).optional(),
  cost: finiteNumber().optional(),
  durationMs: finiteNumber().optional(),
  model: Joi.string().required(),
  requestId: Joi.string().required(),
  response: Joi.object({
    durationMs: finiteNumber().optional(),
    reasoning: Joi.string().allow(null).optional(),
    reply: Joi.string().allow(null).optional(),
    toolCalls: Joi.array().items(toolCallWireSchema).optional(),
  }).unknown(true).optional(),
  thinkingMode: Joi.boolean().required(),
  timestamp: Joi.string().required(),
  usage: Joi.object(usageTokenShape).unknown(true).required(),
}).unknown(true);

const patchStageRuntimeSnapshotBodySchema = Joi.object({
  contextAfter: Joi.any().optional(),
  contextBefore: Joi.any().optional(),
  requestId: Joi.string().optional(),
  timestamp: Joi.string().optional(),
})
  .unknown(true)
  .custom((value, helpers) => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return value;
    const o = value as Record<string, unknown>;
    if ("contextAfter" in o || "contextBefore" in o) return value;
    return helpers.error("any.invalid");
  });

const forkLineageSchema = Joi.object({
  sourceSessionId: Joi.string().required(),
  sourceRequestId: Joi.string().required(),
  stageIndex: Joi.number().integer().required(),
}).unknown(true);

const registerBodySchema = Joi.object({
  taskYahlPath: Joi.string().required(),
  forkLineage: forkLineageSchema.optional(),
}).unknown(true);

const requestSnapshotOverrideSchema = Joi.object({
  currentStage: Joi.string().required(),
  context: Joi.object().unknown(true).required(),
}).unknown(true);

const rerunRequestBodySchema = Joi.object({
  sourceSessionId: Joi.string().required(),
  sourceRequestId: Joi.string().required(),
  sourceStageId: Joi.string().required(),
  requestSnapshotOverride: requestSnapshotOverrideSchema.required(),
}).unknown(true);

const parsedStageWireSchema = Joi.object({
  lines: Joi.string().required(),
  sourceStartLine: Joi.number().integer().required(),
  type: Joi.string().valid("loop", "plain").required(),
}).unknown(true);

const finalizeBodySchema = Joi.object({
  result: Joi.any().optional(),
  stages: Joi.array().items(parsedStageWireSchema).optional(),
}).unknown(true);

const updateSessionTitleBodySchema = Joi.object({
  title: Joi.string().trim().min(1).max(120).required(),
}).unknown(true);

const askUserOptionSchema = Joi.object({
  description: Joi.string().allow("").optional(),
  id: Joi.string().trim().min(1).required(),
  label: Joi.string().trim().min(1).required(),
}).unknown(false);

const askUserQuestionSchema = Joi.object({
  allowMultiple: Joi.boolean().optional(),
  description: Joi.string().allow("").optional(),
  kind: Joi.string().valid("multipleChoice").required(),
  maxChoices: Joi.number().integer().min(1).optional(),
  minChoices: Joi.number().integer().min(0).optional(),
  options: Joi.array().items(askUserOptionSchema).min(2).required(),
  title: Joi.string().trim().min(1).max(240).required(),
  version: Joi.string().valid("askUser.v1").required(),
}).unknown(false);

const createAskUserQuestionBodySchema = Joi.object({
  question: askUserQuestionSchema.required(),
  requestId: Joi.string().trim().min(1).required(),
  stageId: Joi.string().trim().min(1).required(),
}).unknown(false);

const answerAskUserQuestionBodySchema = Joi.object({
  answerIds: Joi.array().items(Joi.string().trim().min(1)).min(1).required(),
}).unknown(false);

const timedOutRecoveryBodySchema = Joi.object({
  currentStageText: Joi.string().required(),
  questionId: Joi.string().trim().min(1).required(),
  requestId: Joi.string().trim().min(1).required(),
  runtimeSnapshot: Joi.object({
    context: Joi.object().unknown(true).required(),
    stage: Joi.object().unknown(true).required(),
    types: Joi.object().unknown(true).required(),
  }).required(),
  sourceRef: Joi.object({
    filePath: Joi.string().trim().min(1).required(),
    line: Joi.number().integer().min(0).required(),
  }).required(),
  stageId: Joi.string().trim().min(1).required(),
}).unknown(false);

const resumeAskUserBodySchema = Joi.object({
  questionId: Joi.string().trim().min(1).optional(),
}).unknown(false);

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

export const isCreateStageBody = (value: unknown): value is CreateStagePayload =>
  passes(createStageBodySchema, value);

export const isCreateToolCallsBody = (value: unknown): value is CreateToolCallsPayload =>
  passes(createToolCallsBodySchema, value);

export const isCreateModelResponseBody = (value: unknown): value is CreateModelResponsePayload =>
  passes(createModelResponseBodySchema, value);

export const isPatchStageRuntimeSnapshotBody = (
  value: unknown,
): value is PatchStageRuntimeSnapshotPayload => passes(patchStageRuntimeSnapshotBodySchema, value);

export const isRegisterBody = (value: unknown): value is RegisterSessionPayload =>
  passes(registerBodySchema, value);

export const isRerunRequestBody = (value: unknown): value is RerunRequestPayload =>
  passes(rerunRequestBodySchema, value);

export const isFinalizeBody = (value: unknown): value is FinalizeSessionPayload => {
  if (value === undefined) return true;
  return passes(finalizeBodySchema, value);
};

export const isUpdateSessionTitleBody = (value: unknown): value is UpdateSessionTitlePayload =>
  passes(updateSessionTitleBodySchema, value);

export const isCreateAskUserQuestionBody = (value: unknown): value is CreateAskUserQuestionPayload =>
  passes(createAskUserQuestionBodySchema, value);

export const isAnswerAskUserQuestionBody = (value: unknown): value is AnswerAskUserQuestionPayload =>
  passes(answerAskUserQuestionBodySchema, value);

export const isTimedOutRecoveryBody = (value: unknown): value is AskUserTimedOutRecoveryPayload =>
  passes(timedOutRecoveryBodySchema, value);

export const isResumeAskUserBody = (value: unknown): value is { questionId?: string } =>
  passes(resumeAskUserBodySchema, value);
