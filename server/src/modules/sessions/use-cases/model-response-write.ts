import Joi from 'joi';

import { Middlewares } from '@omni-infra/express';
import { Queries } from '@omni-infra/mongoose';

import { resolveSessionBySessionId } from '../-resolve-session';
import { emitSessionEvent } from '../-session-events';
import type { TModelResponseTag } from '../-types';
import { modelModelResponse, modelStage } from '../models';

import type { TRequestStageParams } from './stage-write';

const BASE_MODEL_RESPONSE_TAGS = ['browse', 'stagehand', 'bash', 'tool', 'chat', 'unknown'] as const;

const isModelResponseTag = (value: unknown): value is TModelResponseTag => {
  if (typeof value !== 'string' || !value.trim()) {
    return false;
  }

  if ((BASE_MODEL_RESPONSE_TAGS as readonly string[]).includes(value)) {
    return true;
  }

  return (
    (value.startsWith('platform:') && value.length > 'platform:'.length)
    || (value.startsWith('mastermind:') && value.length > 'mastermind:'.length)
    || (value.startsWith('nixery:') && value.length > 'nixery:'.length)
  );
};

const modelResponseTagSchema = Joi.string().custom((value, helpers) => {
  if (isModelResponseTag(value)) {
    return value;
  }

  return helpers.error('any.invalid');
});

export type TRequestCreateModelResponseBody = {
  domain?: string;
  durationMs?: number;
  response: Record<string, unknown>;
  tags?: TModelResponseTag[];
  thinkingMode?: boolean;
};

export type TResponseCreateModelResponse = {
  ok: true;
};

const bodySchema = Joi.object<TRequestCreateModelResponseBody>({
  domain: Joi.string().trim().optional(),
  durationMs: Joi.number().optional(),
  response: Joi.object().required(),
  tags: Joi.array().items(modelResponseTagSchema).optional(),
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
        ...(body.domain?.trim() ? { domain: body.domain.trim() } : {}),
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
