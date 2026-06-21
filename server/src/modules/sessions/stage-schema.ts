import Joi from 'joi';

import type { TParsedStage, TYahlStage } from './-types';

const LOOP_SETUP_PATTERN = /^\s*for each\s+\w+\s+of\s+\[.*\]\s*$/i;

const stringArraySchema = Joi.array().items(Joi.string());

const askUserOptionSchema = Joi.object({
  description: Joi.string().optional(),
  id: Joi.string().trim().required(),
  label: Joi.string().trim().required(),
});

const askUserEntrySchema = Joi.object({
  answer: Joi.alternatives().try(Joi.number(), Joi.string()).optional(),
  id: Joi.string().trim().required(),
  options: Joi.array().items(askUserOptionSchema).min(2).optional(),
  question: Joi.string().trim().required(),
});

export const yahlStageSchema = Joi.object<TYahlStage>({
  askUser: Joi.array().items(askUserEntrySchema).min(1).optional(),
  conditionMode: Joi.boolean().optional(),
  contextKeys: stringArraySchema.optional(),
  contextMode: Joi.boolean().optional(),
  logic: Joi.string().trim().required(),
  loopSetup: Joi.string().trim().pattern(LOOP_SETUP_PATTERN).optional(),
  planMode: Joi.boolean().optional(),
  produceContextKeys: stringArraySchema.optional(),
  produceTypeKeys: stringArraySchema.optional(),
  temperature: Joi.number().min(0).max(2).optional(),
  updateContextKeys: stringArraySchema.optional(),
  verify: Joi.boolean().optional(),
  verifyMinScore: Joi.number().min(0).max(1).optional(),
  verifyResume: Joi.boolean().optional(),
  verifyRubric: Joi.string().trim().optional(),
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
