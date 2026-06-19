import { randomUUID } from 'crypto';

import Joi from 'joi';

import { Middlewares } from '@omni-infra/express';
import { Queries } from '@omni-infra/mongoose';

import { resolveSessionBySessionId } from '../-resolve-session';
import { isStageFinished } from '../-stage-status';
import { emitSessionEvent } from '../-session-events';
import type { TParsedStageSnapshot, TYahlStage } from '../-types';
import { modelStage, modelVerifyCheckpoint } from '../models';
import { yahlStageSchema } from '../stage-schema';
import { spawnOrchestrate } from './spawn-orchestrate';

export type TRequestCreateVerifyCheckpointBody = {
  contextSnapshot: Record<string, unknown>;
  feedback: string;
  forkSetupIndex?: number;
  loopMeta?: Record<string, unknown>;
  parsedStageSnapshot: TParsedStageSnapshot;
  requestId: string;
  score: number;
  stage: TYahlStage;
  stageIndex?: number;
  storageSnapshot: Record<string, unknown>;
};

const sessionParamsSchema = Joi.object({
  sessionId: Joi.string().trim().required(),
});

const verifyParamsSchema = Joi.object({
  sessionId: Joi.string().trim().required(),
  verifyId: Joi.string().trim().required(),
});

const parsedStageSnapshotSchema = Joi.object<TParsedStageSnapshot>({
  lines: Joi.string().required(),
  sourceStartLine: Joi.number().integer().min(1).required(),
  type: Joi.string().valid('loop', 'plain').required(),
});

const createBodySchema = Joi.object<TRequestCreateVerifyCheckpointBody>({
  contextSnapshot: Joi.object().required(),
  feedback: Joi.string().required(),
  forkSetupIndex: Joi.number().optional(),
  loopMeta: Joi.object().optional(),
  parsedStageSnapshot: parsedStageSnapshotSchema.required(),
  requestId: Joi.string().trim().required(),
  score: Joi.number().min(0).max(1).required(),
  stage: yahlStageSchema.required(),
  stageIndex: Joi.number().optional(),
  storageSnapshot: Joi.object().required(),
});

export const createVerifyCheckpoint = [
  Middlewares.Chainable
    .validate(({ req }) => ({
      body: joi.getValidatedOrThrow(createBodySchema, req.body),
      params: joi.getValidatedOrThrow(sessionParamsSchema, req.params),
    }))
    .next(async (express, { body, params }) => {
      const session = await resolveSessionBySessionId(params.sessionId);
      const sessionRef = session._id;
      const verifyId = randomUUID();

      await modelVerifyCheckpoint.create({
        contextSnapshot: body.contextSnapshot,
        feedback: body.feedback,
        forkSetupIndex: body.forkSetupIndex,
        loopMeta: body.loopMeta,
        parsedStageSnapshot: body.parsedStageSnapshot,
        requestId: body.requestId,
        score: body.score,
        session: sessionRef,
        stage: body.stage,
        ...(body.stageIndex === undefined ? {} : { stageIndex: body.stageIndex }),
        status: 'pending',
        storageSnapshot: body.storageSnapshot,
        verifyId,
      });

      await modelStage.updateOne(
        { requestId: body.requestId, session: sessionRef },
        {
          $set: {
            verifyResult: {
              feedback: body.feedback,
              pass: false,
              score: body.score,
            },
          },
        },
      );

      emitSessionEvent(params.sessionId, {
        requestId: body.requestId,
        type: 'verify.failed',
        verifyId,
      });

      express.res.status(201);
      express.respondOne({ verifyId });
    })
    .toMiddleware(),
];

export const resumeVerifyCheckpoint = [
  Middlewares.Chainable
    .validate(({ req }) => ({
      params: joi.getValidatedOrThrow(verifyParamsSchema, req.params),
    }))
    .next(async (express, { params }) => {
      const session = await resolveSessionBySessionId(params.sessionId);
      const sessionRef = session._id;

      const checkpoint = await Queries.hasExactOne(modelVerifyCheckpoint, {
        session: sessionRef,
        status: 'pending',
        verifyId: params.verifyId,
      });

      const stage = await Queries.hasExactOne(modelStage, {
        requestId: checkpoint.requestId,
        session: sessionRef,
      });

      if (isStageFinished(stage)) {
        throw errors.badRequest('stage already finished');
      }

      await modelVerifyCheckpoint.updateOne(
        { verifyId: params.verifyId },
        { $set: { status: 'resumed' } },
      );

      emitSessionEvent(params.sessionId, {
        requestId: checkpoint.requestId,
        type: 'verify.resumed',
        verifyId: params.verifyId,
      });

      spawnOrchestrate(params.sessionId, ['--verify-resume-id', params.verifyId]);

      express.respondOne({ ok: true, verifyId: params.verifyId });
    })
    .toMiddleware(),
];

export const getVerifyCheckpoint = [
  Middlewares.Chainable
    .validate(({ req }) => ({
      params: joi.getValidatedOrThrow(verifyParamsSchema, req.params),
    }))
    .next(async (express, { params }) => {
      const session = await resolveSessionBySessionId(params.sessionId);

      const checkpoint = await Queries.hasExactOne(modelVerifyCheckpoint, {
        session: session._id,
        verifyId: params.verifyId,
      });

      express.respondOne({
        feedback: checkpoint.feedback,
        score: checkpoint.score,
        status: checkpoint.status,
        verifyId: checkpoint.verifyId,
      });
    })
    .toMiddleware(),
];
