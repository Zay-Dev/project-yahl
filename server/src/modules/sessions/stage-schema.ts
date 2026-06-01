import Joi from 'joi';

import type { TYahlStage } from './-types';

const LOOP_SETUP_PATTERN = /^\s*for each\s+\w+\s+of\s+\[.*\]\s*$/i;

const stringArraySchema = Joi.array().items(Joi.string());

export const yahlStageSchema = Joi.object<TYahlStage>({
  conditionMode: Joi.boolean().optional(),
  contextKeys: stringArraySchema.optional(),
  contextMode: Joi.boolean().optional(),
  logic: Joi.string().trim().required(),
  loopSetup: Joi.string().trim().pattern(LOOP_SETUP_PATTERN).optional(),
  produceContextKeys: stringArraySchema.optional(),
  produceTypeKeys: stringArraySchema.optional(),
  temperature: Joi.number().min(0).max(2).optional(),
  updateContextKeys: stringArraySchema.optional(),
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
