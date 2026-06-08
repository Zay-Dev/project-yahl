import Joi from 'joi';

import { Middlewares } from '@omni-infra/express';
import { Queries } from '@omni-infra/mongoose';

import { resolveSessionBySessionId } from '../-resolve-session';
import { emitSessionEvent } from '../-session-events';
import type { TStageLoopMeta, TYahlStage } from '../-types';
import { modelSession, modelStage } from '../models';
import { yahlStageSchema } from '../stage-schema';

export type TRequestSessionParams = {
  sessionId: string;
};

export type TRequestStageParams = TRequestSessionParams & {
  requestId: string;
};

export type TRequestCreateStageBody = {
  context: Record<string, unknown>;
  loopMeta?: TStageLoopMeta;
  requestId: string;
  stage: TYahlStage;
  temperature?: number;
};

export type TRequestPatchStageBody = {
  contextAfter: Record<string, unknown>;
};

export type TResponseCreateStage = {
  ok: true;
  requestId: string;
};

export type TResponsePatchStage = {
  ok: true;
};

const loopMetaSchema = Joi.object({
  arraySnapshot: Joi.array().required(),
  endAfter: Joi.number().optional(),
  index: Joi.number().required(),
  indexName: Joi.string().optional(),
  startAt: Joi.number().optional(),
  step: Joi.number().optional(),
  temperature: Joi.number().optional(),
  value: Joi.any().required(),
}).unknown(true);

const createStageBodySchema = Joi.object<TRequestCreateStageBody>({
  context: Joi.object().required(),
  loopMeta: loopMetaSchema.optional(),
  requestId: Joi.string().trim().required(),
  stage: yahlStageSchema.required(),
  temperature: Joi.number().optional(),
});

const patchStageBodySchema = Joi.object<TRequestPatchStageBody>({
  contextAfter: Joi.object().required(),
});

const sessionParamsSchema = Joi.object<TRequestSessionParams>({
  sessionId: Joi.string().trim().required(),
});

const stageParamsSchema = Joi.object<TRequestStageParams>({
  requestId: Joi.string().trim().required(),
  sessionId: Joi.string().trim().required(),
});

export const createStage = [
  Middlewares.Chainable
    .validate(({ req }) => ({
      body: joi.getValidatedOrThrow(createStageBodySchema, req.body),
      params: joi.getValidatedOrThrow(sessionParamsSchema, req.params),
    }))
    .next(async (express, { body, params }) => {
      const now = new Date();

      await modelSession.updateOne(
        { sessionId: params.sessionId },
        {
          $set: { updatedAt: now },
          $setOnInsert: { sessionId: params.sessionId },
        },
        { upsert: true },
      );

      const session = await resolveSessionBySessionId(params.sessionId);
      const sessionRef = session._id;
      const temperature = body.temperature ?? body.stage.temperature;

      await modelStage.updateOne(
        { requestId: body.requestId, session: sessionRef },
        {
          $set: {
            context: body.context,
            loopMeta: body.loopMeta,
            stage: body.stage,
            session: sessionRef,
            ...(temperature === undefined ? {} : { temperature }),
            updatedAt: now,
          },
          $setOnInsert: {
            requestId: body.requestId,
          },
          $unset: {
            contextAfter: '',
            finishedAt: '',
          },
        },
        { upsert: true },
      );

      emitSessionEvent(params.sessionId, { type: 'session.updated' });
      emitSessionEvent(params.sessionId, { requestId: body.requestId, type: 'stage.created' });

      express.res.status(202);
      express.respondOne<TResponseCreateStage>({ ok: true, requestId: body.requestId });
    })
    .toMiddleware(),
];

export const patchStage = [
  Middlewares.Chainable
    .validate(({ req }) => ({
      body: joi.getValidatedOrThrow(patchStageBodySchema, req.body),
      params: joi.getValidatedOrThrow(stageParamsSchema, req.params),
    }))
    .next(async (express, { body, params }) => {
      const now = new Date();
      const session = await resolveSessionBySessionId(params.sessionId);
      const sessionRef = session._id;

      await Queries.hasExactOne(modelStage, {
        requestId: params.requestId,
        session: sessionRef,
      });

      await modelStage.updateOne(
        { requestId: params.requestId, session: sessionRef },
        {
          $set: {
            contextAfter: body.contextAfter,
            finishedAt: now,
            updatedAt: now,
          },
        },
      );

      emitSessionEvent(params.sessionId, { requestId: params.requestId, type: 'stage.finished' });

      express.respondOne<TResponsePatchStage>({ ok: true });
    })
    .toMiddleware(),
];
