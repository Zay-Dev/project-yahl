import Joi from 'joi';

import { Repository } from '@/core';

import { Middlewares } from '@omni-infra/express';
import { Queries } from '@omni-infra/mongoose';

import type {
  TRequestCreateCronJobBody,
  TRequestCronJobParams,
  TRequestUpdateCronJobBody,
  TResponseCronJobMutation,
} from '../-api-types';
import { toCronJobResponse } from '../-cron-map';
import { modelCronJob } from '../models';

const paramsSchema = Joi.object<TRequestCronJobParams>({
  id: Joi.string().trim().required(),
});

const runInputSchema = Joi.object().pattern(Joi.string(), Joi.string().allow('')).optional();

const createBodySchema = Joi.object<TRequestCreateCronJobBody>({
  enabled: Joi.boolean().default(true),
  id: Joi.string().trim().required(),
  orgId: Joi.string().trim().optional(),
  orgUnitId: Joi.string().trim().optional(),
  runInput: runInputSchema,
  schedule: Joi.string().trim().required(),
  taskPath: Joi.string().trim().required(),
  timezone: Joi.string().trim().optional(),
  userId: Joi.string().trim().optional(),
});

const updateBodySchema = Joi.object<TRequestUpdateCronJobBody>({
  enabled: Joi.boolean().optional(),
  orgId: Joi.string().trim().optional(),
  orgUnitId: Joi.string().trim().optional(),
  runInput: runInputSchema,
  schedule: Joi.string().trim().optional(),
  taskPath: Joi.string().trim().optional(),
  timezone: Joi.string().trim().optional(),
  userId: Joi.string().trim().optional(),
}).min(1);

const assertTaskRunInput = async (
  taskPath: string,
  runInput: Record<string, string> | undefined,
) => {
  const validation = await Repository.resolve('validateTaskRunInput')(taskPath, runInput);

  if (!validation.ok) {
    throw errors.badRequest(validation.message);
  }
};

export const createCronJob = [
  Middlewares.Chainable
    .validate(({ req }) => ({
      body: joi.getValidatedOrThrow(createBodySchema, req.body),
    }))
    .next(async (express, { body }) => {
      await assertTaskRunInput(body.taskPath, body.runInput);

      const existing = await Queries.queryBy(modelCronJob, { id: body.id }).countDocuments();

      if (existing > 0) {
        throw errors.badRequest('cron job id already exists');
      }

      try {
        await modelCronJob.create(body);
      } catch (error) {
        if (
          error
          && typeof error === 'object'
          && 'code' in error
          && error.code === 11000
        ) {
          throw errors.badRequest('cron job id already exists');
        }

        throw error;
      }
      express.res.status(201);
      express.respondOne<TResponseCronJobMutation>({ id: body.id, ok: true });
    })
    .toMiddleware(),
];

export const updateCronJob = [
  Middlewares.Chainable
    .validate(({ req }) => ({
      body: joi.getValidatedOrThrow(updateBodySchema, req.body),
      params: joi.getValidatedOrThrow(paramsSchema, req.params),
    }))
    .next(async (express, { body, params }) => {
      const existing = await Queries.hasExactOne(modelCronJob, { id: params.id });
      const taskPath = body.taskPath ?? existing.taskPath;
      const runInput = body.runInput !== undefined ? body.runInput : existing.runInput;

      await assertTaskRunInput(taskPath, runInput);

      await modelCronJob.updateOne({ id: params.id }, { $set: body });

      const doc = await Queries.hasExactOne(modelCronJob, { id: params.id });

      express.respondOne(toCronJobResponse(doc));
    })
    .toMiddleware(),
];

export const deleteCronJob = [
  Middlewares.Chainable
    .validate(({ req }) => ({
      params: joi.getValidatedOrThrow(paramsSchema, req.params),
    }))
    .next(async (express, { params }) => {
      await Queries.hasExactOne(modelCronJob, { id: params.id });

      await modelCronJob.updateOne(
        { id: params.id },
        { $set: { deletedAt: new Date() } },
      );

      express.respondOne<TResponseCronJobMutation>({ id: params.id, ok: true });
    })
    .toMiddleware(),
];
