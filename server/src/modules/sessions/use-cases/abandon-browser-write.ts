import Joi from 'joi';

import { Middlewares } from '@omni-infra/express';

import {
  markSessionBrowserAbandoned,
  tearDownBrowserContainer,
} from '../-abandon-browser-session';
import { resolveSessionBySessionId } from '../-resolve-session';

export type TBrowserAbandonedReason = 'stop' | 'terminal' | 'ttl';

export type TRequestAbandonBrowserParams = {
  sessionId: string;
};

export type TRequestAbandonBrowserBody = {
  reason: TBrowserAbandonedReason;
};

export type TResponseAbandonBrowser = {
  ok: true;
  reason: TBrowserAbandonedReason;
};

const paramsSchema = Joi.object<TRequestAbandonBrowserParams>({
  sessionId: Joi.string().trim().required(),
});

const bodySchema = Joi.object<TRequestAbandonBrowserBody>({
  reason: Joi.string().valid('stop', 'terminal', 'ttl').required(),
});

export const abandonBrowserSession = [
  Middlewares.Chainable
    .validate(({ req }) => ({
      body: joi.getValidatedOrThrow(bodySchema, req.body),
      params: joi.getValidatedOrThrow(paramsSchema, req.params),
    }))
    .next(async (express, { body, params }) => {
      const session = await resolveSessionBySessionId(params.sessionId);

      tearDownBrowserContainer(params.sessionId);
      await markSessionBrowserAbandoned(String(session._id), params.sessionId, body.reason);

      express.respondOne<TResponseAbandonBrowser>({
        ok: true,
        reason: body.reason,
      });
    })
    .toMiddleware(),
];
