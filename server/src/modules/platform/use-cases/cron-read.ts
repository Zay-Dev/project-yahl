import Joi from 'joi';

import { Middlewares } from '@omni-infra/express';
import { Queries } from '@omni-infra/mongoose';

import type { TRequestCronJobParams, TResponseCronJob, TResponseCronJobs } from '../-api-types';
import { toCronJobResponse } from '../-cron-map';
import { modelCronJob } from '../models';

const paramsSchema = Joi.object<TRequestCronJobParams>({
  id: Joi.string().trim().required(),
});

export const listCronJobs = [
  Middlewares.Chainable
    .next(async (express) => {
      const items = await Queries.queryBy(modelCronJob, {});

      express.respondOne<TResponseCronJobs>({
        items: items.map(toCronJobResponse),
      });
    })
    .toMiddleware(),
];

export const getCronJob = [
  Middlewares.Chainable
    .validate(({ req }) => ({
      params: joi.getValidatedOrThrow(paramsSchema, req.params),
    }))
    .next(async (express, { params }) => {
      const doc = await Queries.hasExactOne(modelCronJob, { id: params.id });

      express.respondOne<TResponseCronJob>(toCronJobResponse(doc));
    })
    .toMiddleware(),
];
