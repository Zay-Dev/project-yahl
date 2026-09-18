import Joi from 'joi';

import { Middlewares } from '@omni-infra/express';

import { writeQuotaState } from '@/-quota-state';
import { assertControlPlaneServiceToken } from '@/modules/sessions/-control-plane-token';

export type TRequestPatchQuotaBody = {
  exhausted: boolean;
  remainingPercent?: number;
};

const quotaBodySchema = Joi.object<TRequestPatchQuotaBody>({
  exhausted: Joi.boolean().required(),
  remainingPercent: Joi.number().min(0).max(100).optional(),
});

const resolveRemainingPercent = (body: TRequestPatchQuotaBody): number => {
  if (typeof body.remainingPercent === 'number') {
    return body.remainingPercent;
  }

  return body.exhausted ? 0 : 100;
};

export const patchQuota = [
  Middlewares.Chainable
    .next(async (express) => {
      assertControlPlaneServiceToken(express.req.headers['x-control-plane-token']);
    })
    .validate(({ req }) => ({
      body: joi.getValidatedOrThrow(quotaBodySchema, req.body),
    }))
    .next(async (express, { body }) => {
      const quotaStateFile = process.env.QUOTA_STATE_FILE?.trim() ?? '';

      if (quotaStateFile) {
        writeQuotaState({
          exhausted: body.exhausted,
          remainingPercent: resolveRemainingPercent(body),
        });
      }

      express.respondOne({
        exhausted: body.exhausted,
        ok: true,
        remainingPercent: resolveRemainingPercent(body),
      });
    })
    .toMiddleware(),
];
