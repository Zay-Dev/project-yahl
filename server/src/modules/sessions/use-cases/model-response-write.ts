import Joi from 'joi';

import { Middlewares } from '@omni-infra/express';
import { Queries } from '@omni-infra/mongoose';

import { resolveSessionBySessionId } from '../-resolve-session';
import { modelModelResponse, modelStage } from '../models';

import type { TRequestStageParams } from './stage-write';

export type TRequestCreateModelResponseBody = {
  durationMs?: number;
  response: Record<string, unknown>;
  thinkingMode?: boolean;
};

export type TResponseCreateModelResponse = {
  ok: true;
};

const bodySchema = Joi.object<TRequestCreateModelResponseBody>({
  durationMs: Joi.number().optional(),
  response: Joi.object().required(),
  thinkingMode: Joi.boolean().optional(),
});

const paramsSchema = Joi.object<TRequestStageParams>({
  requestId: Joi.string().trim().required(),
  sessionId: Joi.string().trim().required(),
});

export const createModelResponse = [
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

      await modelModelResponse.create({
        durationMs: body.durationMs,
        requestId: params.requestId,
        response: body.response,
        session: sessionRef,
        thinkingMode: body.thinkingMode,
      });

      express.res.status(202);
      express.respondOne<TResponseCreateModelResponse>({ ok: true });
    })
    .toMiddleware(),
];
