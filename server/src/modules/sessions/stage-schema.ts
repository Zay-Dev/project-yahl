import Joi from 'joi';

import { STAGE_ID_PATTERN } from '@project-yahl/shared/yahl/stage-goto';

import type { TParsedStage, TYahlStage } from './-types';

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
});

const agentOverridesSchema = Joi.object({
  bashTimeoutMs: Joi.number().integer().min(1).optional(),
}).unknown(false);

const gotoEntrySchema = Joi.object({
  command: Joi.string().trim().pattern(STAGE_GOTO_COMMAND_PATTERN).required(),
  description: Joi.string().trim().required(),
});

export const yahlStageSchema = Joi.object<TYahlStage>({
  agentOverrides: agentOverridesSchema.optional(),
  askUser: Joi.array().items(askUserEntrySchema).min(1).optional(),
  conditionMode: Joi.boolean().optional(),
  contextKeys: stringArraySchema.optional(),
  contextMode: Joi.boolean().optional(),
  goto: Joi.array().items(gotoEntrySchema).min(1).optional(),
  id: Joi.string().trim().pattern(STAGE_ID_PATTERN).optional(),
  logic: Joi.string().trim().when('nixeryRun', {
    is: Joi.exist(),
    otherwise: Joi.required(),
    then: Joi.optional(),
  }),
  loopSetup: Joi.string().trim().pattern(LOOP_SETUP_PATTERN).optional(),
  maxBashCalls: Joi.number().integer().min(1).optional(),
  maxTurns: Joi.number().integer().min(1).optional(),
  nixeryInput: Joi.object().min(1).optional(),
  nixeryRun: Joi.string().trim().optional(),
  produceContextKeys: stringArraySchema.optional(),
  produceTypeKeys: stringArraySchema.optional(),
  temperature: Joi.number().min(0).max(2).optional(),
  updateContextKeys: stringArraySchema.optional(),
  verify: verifySpecSchema.optional(),
  version: Joi.number().integer().min(1).optional(),
})
  .custom((value, helpers) => {
    if (value.contextMode === true && value.conditionMode === true) {
      return helpers.error('any.invalid', { message: 'contextMode and conditionMode are mutually exclusive' });
    }

    if (value.conditionMode === true && value.loopSetup !== undefined) {
      return helpers.error('any.invalid', { message: 'conditionMode and loopSetup are mutually exclusive' });
    }

    if (value.conditionMode === true && !String(value.logic).includes('IF:')) {
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

      if (value.produceContextKeys !== undefined) {
        return helpers.error('any.invalid', { message: 'nixeryRun stages must not set produceContextKeys' });
      }

      if (!value.nixeryInput || Object.keys(value.nixeryInput).length === 0) {
        return helpers.error('any.invalid', { message: 'nixeryInput is required when nixeryRun is set' });
      }
    }

    return value;
  });

export const parsedStageSchema = Joi.object<TParsedStage>({
  contextKeys: stringArraySchema.optional(),
  lines: Joi.string().required(),
  produceContextKeys: stringArraySchema.optional(),
  produceTypeKeys: stringArraySchema.optional(),
  sourceStartLine: Joi.number().integer().min(1).required(),
  spec: yahlStageSchema.required(),
  temperature: Joi.number().min(0).max(2).optional(),
  type: Joi.string().valid('loop', 'plain').required(),
  updateContextKeys: stringArraySchema.optional(),
});
