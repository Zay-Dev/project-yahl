import { readQuotaState } from '@/-quota-state';

import { Middlewares } from '@omni-infra/express';

export const getQuotaStatus = [
  Middlewares.Chainable
    .next(async (express) => {
      const state = readQuotaState();

      express.respondOne({
        exhausted: state?.exhausted ?? false,
        remainingPercent: state?.remainingPercent ?? null,
      });
    })
    .toMiddleware(),
];
