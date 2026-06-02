import Joi from 'joi';

import { Queries } from '@omni-infra/mongoose';
import { Middlewares } from '@omni-infra/express';

import { emitSessionEvent } from '../-session-events';
import { modelSession } from '../models';

export type TRequestRegisterSessionParams = {
  sessionId: string;
};

export type TRequestRegisterSessionBody = {
  taskYahlPath: string;
};

export type TResponseRegisterSession = {
  ok: true;
};

export type TRequestPatchSessionBody = {
  result?: unknown;
};

export type TResponsePatchSession = {
  ok: true;
};

const patchBodySchema = Joi.object<TRequestPatchSessionBody>({
  result: Joi.any().optional(),
});

const bodySchema = Joi.object<TRequestRegisterSessionBody>({
  taskYahlPath: Joi.string().trim().required(),
});

const paramsSchema = Joi.object<TRequestRegisterSessionParams>({
  sessionId: Joi.string().trim().required(),
});

export const registerSession = [
  Middlewares.Chainable
    .validate(({ req }) => ({
      body: joi.getValidatedOrThrow(bodySchema, req.body),
      params: joi.getValidatedOrThrow(paramsSchema, req.params),
    }))
    .next(async (express, { body, params }) => {
      const now = new Date();

      await modelSession.updateOne(
        { sessionId: params.sessionId },
        {
          $set: {
            taskYahlPath: body.taskYahlPath,
            updatedAt: now,
          },
          $setOnInsert: {
            sessionId: params.sessionId,
          },
        },
        { upsert: true },
      );

      emitSessionEvent(params.sessionId, { type: 'session.updated' });

      express.res.status(202);
      express.respondOne<TResponseRegisterSession>({ ok: true });
    })
    .toMiddleware(),
];

export const patchSession = [
  Middlewares.Chainable
    .validate(({ req }) => ({
      body: joi.getValidatedOrThrow(patchBodySchema, req.body),
      params: joi.getValidatedOrThrow(paramsSchema, req.params),
    }))
    .next(async (express, { body, params }) => {
      const now = new Date();

      await Queries.hasExactOne(modelSession, { sessionId: params.sessionId });

      await modelSession.updateOne(
        { sessionId: params.sessionId },
        {
          $set: {
            ...(body.result !== undefined ? { result: body.result } : {}),
            updatedAt: now,
          },
        },
      );

      emitSessionEvent(params.sessionId, { type: 'session.updated' });

      express.respondOne<TResponsePatchSession>({ ok: true });
    })
    .toMiddleware(),
];
