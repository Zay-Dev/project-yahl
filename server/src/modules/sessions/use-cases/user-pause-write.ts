import { randomUUID } from 'crypto';

import Joi from 'joi';

import { Middlewares } from '@omni-infra/express';
import { Queries } from '@omni-infra/mongoose';

import type { TResponseUserPauseCheckpoint } from '../-api-types';
import type { TParsedStageSnapshot, TYahlStage } from '../-types';
import { assertSessionResumeAllowed } from '../-agent-run-active';
import { emitSessionEvent } from '../-session-events';
import { resolveSessionBySessionId } from '../-resolve-session';
import { resolveSessionRunState } from '../-session-run-state';
import { clearSessionControl, requestSessionPause } from '../-session-control-redis';
import { modelStage, modelUserPauseCheckpoint } from '../models';
import { parsedStageSnapshotSchema, yahlStageSchema } from '../stage-schema';
import { spawnOrchestrate } from './spawn-orchestrate';

export type TRequestCreateUserPauseCheckpointBody = {
  contextSnapshot: Record<string, unknown>;
  loopMeta?: Record<string, unknown>;
  parsedStageSnapshot: TParsedStageSnapshot;
  repairInstruction?: string;
  requestId: string;
  stage: TYahlStage;
  stageIndex?: number;
  storageSnapshot: Record<string, unknown>;
};

const sessionParamsSchema = Joi.object({
  sessionId: Joi.string().trim().required(),
});

const pauseParamsSchema = Joi.object({
  pauseId: Joi.string().trim().required(),
  sessionId: Joi.string().trim().required(),
});

const createBodySchema = Joi.object<TRequestCreateUserPauseCheckpointBody>({
  contextSnapshot: Joi.object().required(),
  loopMeta: Joi.object().optional(),
  parsedStageSnapshot: parsedStageSnapshotSchema.required(),
  repairInstruction: Joi.string().trim().optional(),
  requestId: Joi.string().trim().required(),
  stage: yahlStageSchema.required(),
  stageIndex: Joi.number().optional(),
  storageSnapshot: Joi.object().required(),
});

export const toUserPauseCheckpointResponse = (checkpoint: {
  loopMeta?: Record<string, unknown>;
  parsedStageSnapshot?: TParsedStageSnapshot;
  pauseId: string;
  repairInstruction?: string;
  requestId: string;
  stage: TYahlStage;
  stageIndex?: number;
  status: 'pending' | 'resumed';
  storageSnapshot: Record<string, unknown>;
}): TResponseUserPauseCheckpoint => ({
  ...(checkpoint.loopMeta ? { loopMeta: checkpoint.loopMeta } : {}),
  parsedStageSnapshot: checkpoint.parsedStageSnapshot,
  pauseId: checkpoint.pauseId,
  ...(checkpoint.repairInstruction ? { repairInstruction: checkpoint.repairInstruction } : {}),
  requestId: checkpoint.requestId,
  stage: checkpoint.stage,
  stageIndex: checkpoint.stageIndex,
  status: checkpoint.status,
  storageSnapshot: checkpoint.storageSnapshot,
});

export const requestSessionPauseRun = [
  Middlewares.Chainable
    .validate(({ req }) => ({
      params: joi.getValidatedOrThrow(sessionParamsSchema, req.params),
    }))
    .next(async (express, { params }) => {
      const session = await resolveSessionBySessionId(params.sessionId);
      const sessionRef = String(session._id);

      const stages = await Queries.queryBy(modelStage, { session: sessionRef })
        .select('finishedAt requestId verifyingAt')
        .lean();

      const runState = await resolveSessionRunState({
        sessionId: params.sessionId,
        sessionRef,
        stages,
      });

      if (runState !== 'active') {
        throw errors.conflict('Session is not actively running');
      }

      await requestSessionPause(params.sessionId);

      express.respondOne({ ok: true });
    })
    .toMiddleware(),
];

export const createUserPauseCheckpoint = [
  Middlewares.Chainable
    .validate(({ req }) => ({
      body: joi.getValidatedOrThrow(createBodySchema, req.body),
      params: joi.getValidatedOrThrow(sessionParamsSchema, req.params),
    }))
    .next(async (express, { body, params }) => {
      const session = await resolveSessionBySessionId(params.sessionId);
      const sessionRef = String(session._id);
      const pauseId = randomUUID();

      await modelUserPauseCheckpoint.updateOne(
        { pauseId, session: sessionRef },
        {
          $set: {
            contextSnapshot: body.contextSnapshot,
            loopMeta: body.loopMeta,
            parsedStageSnapshot: body.parsedStageSnapshot,
            pauseId,
            ...(body.repairInstruction ? { repairInstruction: body.repairInstruction } : {}),
            requestId: body.requestId,
            session: sessionRef,
            stage: body.stage,
            stageIndex: body.stageIndex,
            status: 'pending',
            storageSnapshot: body.storageSnapshot,
          },
        },
        { upsert: true },
      );

      emitSessionEvent(params.sessionId, {
        pauseId,
        requestId: body.requestId,
        type: 'user_pause.requested',
      });
      emitSessionEvent(params.sessionId, { type: 'session.updated' });

      express.respondOne({ pauseId });
    })
    .toMiddleware(),
];

export const listUserPauseCheckpoints = [
  Middlewares.Chainable
    .validate(({ req }) => ({
      params: joi.getValidatedOrThrow(sessionParamsSchema, req.params),
      query: joi.getValidatedOrThrow(
        Joi.object({ status: Joi.string().valid('pending', 'resumed').optional() }),
        req.query,
      ),
    }))
    .next(async (express, { params, query }) => {
      const session = await resolveSessionBySessionId(params.sessionId);

      const filter: Record<string, unknown> = { session: session._id };

      if (query.status) {
        filter.status = query.status;
      }

      const checkpoints = await Queries.queryBy(modelUserPauseCheckpoint, filter, {
        sort: { createdAt: -1 },
      });

      express.respondMany<TResponseUserPauseCheckpoint>(
        checkpoints.map((checkpoint) => toUserPauseCheckpointResponse(checkpoint)),
      );
    })
    .toMiddleware(),
];

export const getUserPauseCheckpoint = [
  Middlewares.Chainable
    .validate(({ req }) => ({
      params: joi.getValidatedOrThrow(pauseParamsSchema, req.params),
    }))
    .next(async (express, { params }) => {
      const session = await resolveSessionBySessionId(params.sessionId);

      const checkpoint = await Queries.hasExactOne(modelUserPauseCheckpoint, {
        pauseId: params.pauseId,
        session: session._id,
      });

      express.respondOne(toUserPauseCheckpointResponse(checkpoint));
    })
    .toMiddleware(),
];

export const resumeUserPauseCheckpoint = [
  Middlewares.Chainable
    .validate(({ req }) => ({
      params: joi.getValidatedOrThrow(pauseParamsSchema, req.params),
    }))
    .next(async (express, { params }) => {
      const session = await resolveSessionBySessionId(params.sessionId);

      await assertSessionResumeAllowed({
        _id: String(session._id),
        liveViewVncPort: session.liveViewVncPort,
        sessionId: session.sessionId,
      });

      const checkpoint = await modelUserPauseCheckpoint.findOneAndUpdate(
        {
          pauseId: params.pauseId,
          session: session._id,
          status: 'pending',
        },
        { $set: { status: 'resumed' } },
      );

      if (!checkpoint) {
        throw errors.conflict('User pause checkpoint is not pending');
      }

      emitSessionEvent(params.sessionId, {
        pauseId: params.pauseId,
        requestId: checkpoint.requestId,
        type: 'user_pause.resumed',
      });

      await clearSessionControl(params.sessionId);

      try {
        await spawnOrchestrate(params.sessionId, ['--user-pause-resume-id', params.pauseId]);
      } catch (error) {
        await modelUserPauseCheckpoint.updateOne(
          { pauseId: params.pauseId, session: session._id },
          { $set: { status: 'pending' } },
        );

        throw error;
      }

      express.respondOne({ ok: true, pauseId: params.pauseId });
    })
    .toMiddleware(),
];
