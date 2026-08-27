import Joi from 'joi';

import { STAGE_ID_PATTERN } from '@project-yahl/shared/yahl/stage-goto';

import type { TParsedStage, TParsedStageSnapshot, TYahlStage } from './-types';

const LOOP_SETUP_PATTERN = /^\s*for each\s+\w+\s+of\s+\[.*\]\s*$/i;

const STAGE_GOTO_COMMAND_PATTERN = /^\/stage\([a-zA-Z][a-zA-Z0-9_-]*\)$/;

const stringArraySchema = Joi.array().items(Joi.string());

const askUserOptionSchema = Joi.object({
  description: Joi.string().optional(),
  id: Joi.string().trim().required(),
  label: Joi.string().trim().required(),
});

const askUserEntrySchema = Joi.object({
  answer: Joi.alternatives().try(Joi.number(), Joi.string(), Joi.array().items(Joi.string())).optional(),
  id: Joi.string().trim().required(),
  options: Joi.array().items(askUserOptionSchema).min(2).optional(),
  question: Joi.string().trim().required(),
});

const verifySpecSchema = Joi.object({
  autoRetry: Joi.boolean().optional(),
  defId: Joi.string().trim().required(),
  minScore: Joi.number().min(0).max(1).optional(),
  resume: Joi.boolean().optional(),
  rubric: Joi.string().trim().optional(),
  skipWarmUp: Joi.boolean().optional(),
});

const agentOverridesSchema = Joi.object({
  bashTimeoutMs: Joi.number().integer().min(1).optional(),
}).unknown(false);

const stagehandConfigSchema = Joi.object({
  apiBaseUrl: Joi.string().trim().min(1).optional(),
  model: Joi.string().trim().min(1).optional(),
  preferScreenshot: Joi.boolean().optional(),
}).unknown(false);

const gotoEntrySchema = Joi.object({
  command: Joi.string().trim().pattern(STAGE_GOTO_COMMAND_PATTERN).required(),
  description: Joi.string().trim().required(),
});

const whileSetupSchema = Joi.alternatives().try(
  Joi.string().trim().min(1),
  Joi.object({
    condition: Joi.string().trim().min(1).required(),
    doAtLeast: Joi.number().integer().min(1).optional(),
  }),
);

const logicRefSchema = Joi.object({
  $ref: Joi.string().trim().min(1).required(),
}).unknown(false);

const yahlStageSchemaLazy: Joi.ObjectSchema<TYahlStage> = Joi.object<TYahlStage>().keys({
  agentOverrides: agentOverridesSchema.optional(),
  askUser: Joi.array().items(askUserEntrySchema).min(1).optional(),
  cacheMaxAge: Joi.number().integer().min(1).optional(),
  conditionMode: Joi.boolean().optional(),
  contextKeys: stringArraySchema.optional(),
  contextMode: Joi.boolean().optional(),
  goto: Joi.array().items(gotoEntrySchema).min(1).optional(),
  id: Joi.string().trim().pattern(STAGE_ID_PATTERN).optional(),
  knowledgeToScript: Joi.boolean().optional(),
  logic: Joi.alternatives()
    .try(
      Joi.string().trim().min(1),
      logicRefSchema,
      Joi.object({
        stages: Joi.array().items(Joi.link('#yahlStage')).min(1).required(),
        types: Joi.string().optional(),
      }).unknown(false),
    )
    .when('nixeryRun', {
      is: Joi.exist(),
      otherwise: Joi.required(),
      then: Joi.optional(),
    }),
  loopSetup: Joi.string().trim().pattern(LOOP_SETUP_PATTERN).optional(),
  maxBashCalls: Joi.number().integer().min(1).optional(),
  maxTurns: Joi.number().integer().min(1).optional(),
  nixeryInput: Joi.object().min(1).optional(),
  nixeryRun: Joi.string().trim().optional(),
  parallelAfter: stringArraySchema.min(1).optional(),
  parallelGroup: Joi.string().trim().min(1).optional(),
  produceContextKeys: stringArraySchema.optional(),
  produceTypeKeys: stringArraySchema.optional(),
  stagehand: stagehandConfigSchema.optional(),
  subAgent: Joi.boolean().optional(),
  temperature: Joi.number().min(0).max(2).optional(),
  updateContextKeys: stringArraySchema.optional(),
  verify: verifySpecSchema.optional(),
  version: Joi.number().integer().min(1).optional(),
  warmUp: Joi.string().trim().optional(),
  whileSetup: whileSetupSchema.optional(),
})
  .id('yahlStage')
  .custom((value, helpers) => {
    if (value.contextMode === true && value.conditionMode === true) {
      return helpers.error('any.invalid', { message: 'contextMode and conditionMode are mutually exclusive' });
    }

    if (value.loopSetup !== undefined && value.whileSetup !== undefined) {
      return helpers.error('any.invalid', { message: 'loopSetup and whileSetup are mutually exclusive' });
    }

    if (value.conditionMode === true && value.loopSetup !== undefined) {
      return helpers.error('any.invalid', { message: 'conditionMode and loopSetup are mutually exclusive' });
    }

    if (value.conditionMode === true && value.whileSetup !== undefined) {
      return helpers.error('any.invalid', { message: 'conditionMode and whileSetup are mutually exclusive' });
    }

    if (value.warmUp !== undefined && value.loopSetup === undefined && value.whileSetup === undefined) {
      return helpers.error('any.invalid', { message: 'warmUp requires loopSetup or whileSetup' });
    }

    if (value.conditionMode === true && typeof value.logic === 'string' && !value.logic.includes('IF:')) {
      return helpers.error('any.invalid', { message: 'conditionMode logic must contain IF:' });
    }

    if (value.goto?.length) {
      if (value.contextMode === true || value.conditionMode === true) {
        return helpers.error('any.invalid', { message: 'goto cannot combine with contextMode or conditionMode' });
      }

      if (value.nixeryRun) {
        return helpers.error('any.invalid', { message: 'goto cannot combine with nixeryRun' });
      }
    }

    if (value.cacheMaxAge !== undefined) {
      if (value.contextMode === true || value.conditionMode === true || value.nixeryRun) {
        return helpers.error('any.invalid', {
          message: 'cacheMaxAge only valid on AI stages (not contextMode, conditionMode, or nixeryRun)',
        });
      }
    }

    if (value.nixeryRun) {
      if (value.contextMode === true || value.conditionMode === true) {
        return helpers.error('any.invalid', { message: 'nixeryRun cannot combine with contextMode or conditionMode' });
      }

      if (value.verify) {
        return helpers.error('any.invalid', { message: 'nixeryRun cannot combine with verify' });
      }

      if (value.loopSetup !== undefined) {
        return helpers.error('any.invalid', { message: 'nixeryRun cannot combine with loopSetup' });
      }

      if (value.whileSetup !== undefined) {
        return helpers.error('any.invalid', { message: 'nixeryRun cannot combine with whileSetup' });
      }

      if (value.warmUp !== undefined) {
        return helpers.error('any.invalid', { message: 'nixeryRun cannot combine with warmUp' });
      }

      if (value.produceContextKeys !== undefined) {
        return helpers.error('any.invalid', { message: 'nixeryRun stages must not set produceContextKeys' });
      }

      if (!value.nixeryInput || Object.keys(value.nixeryInput).length === 0) {
        return helpers.error('any.invalid', { message: 'nixeryInput is required when nixeryRun is set' });
      }
    }

    if (value.knowledgeToScript === true) {
      if (value.contextMode === true || value.conditionMode === true || value.nixeryRun) {
        return helpers.error('any.invalid', {
          message: 'knowledgeToScript cannot enable on contextMode, conditionMode, or nixeryRun stages',
        });
      }
    }

    return value;
  });

export const yahlStageSchema = yahlStageSchemaLazy;

export const agentMetaSchema = Joi.object({
  isSubAgent: Joi.boolean().required(),
  nestedIndex: Joi.number().integer().min(0).optional(),
  nestedPath: Joi.string().trim().optional(),
  parallelGroupId: Joi.string().trim().optional(),
  parallelSlot: Joi.number().integer().min(0).optional(),
  parentRequestId: Joi.string().trim().optional(),
}).unknown(false);

export const parsedStageSnapshotSchema = Joi.object<TParsedStageSnapshot>({
  lines: Joi.string().required(),
  sourceStartLine: Joi.number().integer().min(1).required(),
  type: Joi.string().valid('loop', 'plain', 'while').required(),
});

export const parsedStageSchema = Joi.object<TParsedStage>({
  contextKeys: stringArraySchema.optional(),
  lines: Joi.string().required(),
  nestedStages: Joi.array().items(Joi.link('#parsedStage')).optional(),
  produceContextKeys: stringArraySchema.optional(),
  produceTypeKeys: stringArraySchema.optional(),
  sourceStartLine: Joi.number().integer().min(1).required(),
  spec: yahlStageSchema.required(),
  temperature: Joi.number().min(0).max(2).optional(),
  type: Joi.string().valid('loop', 'plain', 'while').required(),
  updateContextKeys: stringArraySchema.optional(),
}).id('parsedStage');
