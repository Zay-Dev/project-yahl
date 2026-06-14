import Joi from 'joi';

import { isObjectId } from '@omni-infra/mongoose/types';

const validate = <T,>(
  schema: Joi.AnySchema<T>,
  candidate: unknown,
  options: Parameters<typeof schema.validate>[1] = {},
) => {
  return schema.validate(candidate, { abortEarly: false, ...options });
};

const getValidatedOrThrow = <T,>(
  schema: Joi.AnySchema<T>,
  candidate: unknown,
  options: Parameters<typeof schema.validate>[1] = {},
) => {
  const { value, error } = validate(schema, candidate, options);

  if (error) {
    throw errors.custom(error.message, 400);
  }

  return value as T;
};

const objectId = Joi.string()
  .custom((value, helpers) => {
    return value === undefined ||
      (isObjectId(value) ? value : helpers.error('any.invalid'));
  });

const _Joi = {
  ...Joi,
  getValidatedOrThrow,
  objectId,
  validate,
};

declare global {
  var joi: typeof _Joi;
}

globalThis.joi = _Joi;

export {};
