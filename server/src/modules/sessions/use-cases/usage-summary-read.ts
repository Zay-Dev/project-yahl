import Joi from 'joi';

import { Middlewares } from '@omni-infra/express';

import { Repository } from '@/core';
import { assertControlPlaneServiceToken } from '@/modules/sessions/-control-plane-token';

export const getUsageSummary = [
  Middlewares.Chainable
    .next(async (express) => {
      assertControlPlaneServiceToken(express.req.headers['x-control-plane-token']);
    })
    .validate(({ req }) => ({
      query: joi.getValidatedOrThrow(Joi.object({
        since: Joi.string().isoDate().optional(),
      }), req.query),
    }))
    .next(async (express, { query }) => {
      const since = query.since ? new Date(query.since) : new Date(0);
      const summary = await Repository.resolve('sumUsageSince')({ since });

      express.respondOne(summary);
    })
    .toMiddleware(),
];
