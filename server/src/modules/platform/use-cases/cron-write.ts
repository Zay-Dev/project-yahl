import Joi from 'joi';

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

const createBodySchema = Joi.object<TRequestCreateCronJobBody>({
  enabled: Joi.boolean().default(true),
  id: Joi.string().trim().required(),
  orgId: Joi.string().trim().optional(),
  orgUnitId: Joi.string().trim().optional(),
  schedule: Joi.string().trim().required(),
  taskPath: Joi.string().trim().required(),
  timezone: Joi.string().trim().optional(),
  userId: Joi.string().trim().optional(),
});

const updateBodySchema = Joi.object<TRequestUpdateCronJobBody>({
  enabled: Joi.boolean().optional(),
  orgId: Joi.string().trim().optional(),
  orgUnitId: Joi.string().trim().optional(),
  schedule: Joi.string().trim().optional(),
  taskPath: Joi.string().trim().optional(),
  timezone: Joi.string().trim().optional(),
  userId: Joi.string().trim().optional(),
}).min(1);

export const createCronJob = [
  Middlewares.Chainable
    .validate(({ req }) => ({
      body: joi.getValidatedOrThrow(createBodySchema, req.body),
    }))
    .next(async (express, { body }) => {
      const existing = await Queries.queryBy(modelCronJob, { id: body.id }).countDocuments();

      if (existing > 0) {
        throw errors.badRequest('cron job id already exists');
      }

      await modelCronJob.create(body);
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
      await Queries.hasExactOne(modelCronJob, { id: params.id });

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
