import Joi from 'joi';

import { Middlewares } from '@omni-infra/express';
import { Queries } from '@omni-infra/mongoose';

import { resolveSessionBySessionId } from '../-resolve-session';
import { emitSessionEvent } from '../-session-events';
import { modelModelResponse, modelStage } from '../models';

import type { TRequestStageParams } from './stage-write';

const MODEL_RESPONSE_TAGS = ['browse', 'bash', 'tool', 'chat', 'unknown'] as const;

export type TRequestCreateModelResponseBody = {
  durationMs?: number;
  response: Record<string, unknown>;
  tags?: (typeof MODEL_RESPONSE_TAGS)[number][];
  thinkingMode?: boolean;
};

export type TResponseCreateModelResponse = {
  ok: true;
};

const bodySchema = Joi.object<TRequestCreateModelResponseBody>({
  durationMs: Joi.number().optional(),
  response: Joi.object().required(),
  tags: Joi.array().items(Joi.string().valid(...MODEL_RESPONSE_TAGS)).optional(),
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
        ...(body.tags?.length ? { tags: body.tags } : {}),
        thinkingMode: body.thinkingMode,
      });

      emitSessionEvent(params.sessionId, {
        requestId: params.requestId,
        type: 'stage.model-response',
      });

      express.res.status(202);
      express.respondOne<TResponseCreateModelResponse>({ ok: true });
    })
    .toMiddleware(),
];
