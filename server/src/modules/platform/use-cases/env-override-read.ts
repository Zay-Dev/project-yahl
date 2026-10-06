import type { TResponseEnvOverrideStatus } from '../-api-types';

import { Middlewares } from '@omni-infra/express';

import {
  getAppliedEnvOverrideVersion,
  resolveCurrentEnvOverride,
} from '@/env-override';

export const getEnvOverrideStatus = [
  Middlewares.Chainable
    .next(async (express) => {
      const current = resolveCurrentEnvOverride();
      const appliedVersion = getAppliedEnvOverrideVersion();

      express.respondOne<TResponseEnvOverrideStatus>({
        activeSessionCount: 0,
        appliedVersion,
        currentVersion: current.currentVersion,
        pending: current.currentVersion !== appliedVersion,
      });
    })
    .toMiddleware(),
];
