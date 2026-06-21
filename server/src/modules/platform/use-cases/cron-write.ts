import Joi from 'joi';

import { Middlewares } from '@omni-infra/express';
import { Queries } from '@omni-infra/mongoose';

import type { TResponseCronJobs } from '../-types';
import { modelCronJob } from '../models';

export const listCronJobs = [
  Middlewares.Chainable
    .next(async (express) => {
      const items = await Queries.queryBy(modelCronJob, {});

      express.respondOne<TResponseCronJobs>({ items });
    })
    .toMiddleware(),
];

export const createCronJob = [
  Middlewares.Chainable
    .validate(({ req }) => ({
      body: joi.getValidatedOrThrow(Joi.object({
        enabled: Joi.boolean().default(true),
        id: Joi.string().required(),
        orgId: Joi.string().optional(),
        schedule: Joi.string().required(),
        taskPath: Joi.string().required(),
        timezone: Joi.string().optional(),
        userId: Joi.string().optional(),
      }), req.body),
    }))
    .next(async (express, { body }) => {
      await modelCronJob.create(body);
      express.res.status(201);
      express.respondOne({ id: body.id, ok: true });
    })
    .toMiddleware(),
];
