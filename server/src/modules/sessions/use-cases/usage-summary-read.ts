import Joi from 'joi';

import { Repository } from '@/core';

import { Middlewares } from '@omni-infra/express';

const normalizeControlPlaneToken = (value: string) => value.replace(/\s+/g, '');

const assertControlPlaneServiceToken = (headerValue: string | string[] | undefined): void => {
  const expected = normalizeControlPlaneToken(process.env.CONTROL_PLANE_SERVICE_TOKEN ?? '');
  const provided = typeof headerValue === 'string'
    ? normalizeControlPlaneToken(headerValue)
    : '';

  if (!expected || provided !== expected) {
    throw errors.custom('invalid control plane token', 401);
  }
};

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
