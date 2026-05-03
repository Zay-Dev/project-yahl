import Joi from "joi";

const validateOpts = { abortEarly: false, stripUnknown: false } as const;

const createRunBodySchema = Joi.object({
  taskId: Joi.string().trim().min(1).required(),
}).unknown(true);

export const isCreateRunBody = (value: unknown): value is { taskId: string } =>
  createRunBodySchema.validate(value, validateOpts).error === undefined;
