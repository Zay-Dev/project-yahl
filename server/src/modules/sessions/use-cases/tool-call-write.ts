import Joi from 'joi';

import { Middlewares } from '@omni-infra/express';
import { Queries } from '@omni-infra/mongoose';

import { resolveSessionBySessionId } from '../-resolve-session';
import { modelStage, modelToolCall } from '../models';

import type { TRequestStageParams } from './stage-write';

export type TRequestCreateToolCallBody = {
  toolCalls: Record<string, unknown>[];
};

export type TResponseCreateToolCall = {
  ok: true;
};

const bodySchema = Joi.object<TRequestCreateToolCallBody>({
  toolCalls: Joi.array().items(Joi.object()).min(1).required(),
});

const paramsSchema = Joi.object<TRequestStageParams>({
  requestId: Joi.string().trim().required(),
  sessionId: Joi.string().trim().required(),
});

export const createToolCall = [
  Middlewares.Chainable
    .validate(({ req }) => ({
      body: joi.getValidatedOrThrow(bodySchema, req.body),
      params: joi.getValidatedOrThrow(paramsSchema, req.params),
    }))
    .next(async (express, { body, params }) => {
      const session = await resolveSessionBySessionId(params.sessionId);
      const sessionRef = session._id;

      await Queries.hasExactOne(modelStage, {
        requestId: params.requestId,
        session: sessionRef,
      });

      await modelToolCall.create({
        requestId: params.requestId,
        session: sessionRef,
        toolCalls: body.toolCalls,
      });

      express.res.status(202);
      express.respondOne<TResponseCreateToolCall>({ ok: true });
    })
    .toMiddleware(),
];
