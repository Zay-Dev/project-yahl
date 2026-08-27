import Joi from 'joi';

import { Middlewares } from '@omni-infra/express';

import type { TSessionRunState } from '../-session-run-state-signals';
import { emitSessionEvent } from '../-session-events';
import { resolveSessionBySessionId } from '../-resolve-session';
import { resolveSessionRunState } from '../-session-run-state';
import { stopSessionRun } from '../-stop-session-run';
import { modelStage } from '../models';
import { Queries } from '@omni-infra/mongoose';

export type TRequestStopSessionParams = {
  sessionId: string;
};

export type TResponseStopSession = {
  runState: TSessionRunState;
};

const paramsSchema = Joi.object<TRequestStopSessionParams>({
  sessionId: Joi.string().trim().required(),
});

export const stopSession = [
  Middlewares.Chainable
    .validate(({ req }) => ({
      params: joi.getValidatedOrThrow(paramsSchema, req.params),
    }))
    .next(async (express, { params }) => {
      const session = await resolveSessionBySessionId(params.sessionId);
      const sessionRef = String(session._id);

      const stages = await Queries.queryBy(modelStage, { session: sessionRef })
        .select('finishedAt requestId verifyingAt')
        .lean();

      const runStateBefore = await resolveSessionRunState({
        sessionId: params.sessionId,
        sessionRef,
        stages,
      });

      if (runStateBefore === 'idle') {
        throw errors.conflict('Session has no active orchestrator or agent run');
      }

      await stopSessionRun(sessionRef, params.sessionId);

      const runState = await resolveSessionRunState({
        sessionId: params.sessionId,
        sessionRef,
        stages,
      });

      emitSessionEvent(params.sessionId, { type: 'session.stopped' });

      express.respondOne<TResponseStopSession>({ runState });
    })
    .toMiddleware(),
];
