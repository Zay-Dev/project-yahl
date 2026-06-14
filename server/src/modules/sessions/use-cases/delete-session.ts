import Joi from 'joi';

import { Queries } from '@omni-infra/mongoose';
import { Middlewares } from '@omni-infra/express';

import { emitSessionEvent } from '../-session-events';
import { resolveSessionBySessionId } from '../-resolve-session';
import {
  modelForkSession,
  modelModelResponse,
  modelSession,
  modelStage,
  modelToolCall,
} from '../models';

export type TRequestDeleteSessionParams = {
  sessionId: string;
};

export type TRequestDeleteSessionQuery = {
  mode: 'hard' | 'soft';
};

export type TResponseDeleteSession = {
  ok: true;
};

const paramsSchema = Joi.object<TRequestDeleteSessionParams>({
  sessionId: Joi.string().trim().required(),
});

const querySchema = Joi.object<TRequestDeleteSessionQuery>({
  mode: Joi.string().valid('soft', 'hard').required(),
});

const hardDeleteSession = async (sessionId: string) => {
  const session = await resolveSessionBySessionId(sessionId);
  const sessionRef = session._id;

  await Promise.all([
    modelStage.deleteMany({ session: sessionRef }),
    modelModelResponse.deleteMany({ session: sessionRef }),
    modelToolCall.deleteMany({ session: sessionRef }),
    modelForkSession.deleteMany({
      $or: [
        { sourceSessionId: sessionId },
        { targetSessionId: sessionId },
      ],
    }),
  ]);

  await modelSession.deleteOne({ _id: sessionRef });
};

export const deleteSession = [
  Middlewares.Chainable
    .validate(({ req }) => ({
      params: joi.getValidatedOrThrow(paramsSchema, req.params),
      query: joi.getValidatedOrThrow(querySchema, req.query),
    }))
    .next(async (express, { params, query }) => {
      await Queries.hasExactOne(modelSession, { sessionId: params.sessionId });

      if (query.mode === 'soft') {
        await modelSession.updateOne(
          { sessionId: params.sessionId },
          { $set: { deletedAt: new Date() } },
        );
        emitSessionEvent(params.sessionId, { type: 'session.updated' });
      } else {
        await hardDeleteSession(params.sessionId);
      }

      express.respondOne<TResponseDeleteSession>({ ok: true });
    })
    .toMiddleware(),
];
