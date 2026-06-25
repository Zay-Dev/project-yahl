import { randomUUID } from 'crypto';

import Joi from 'joi';

import { Middlewares } from '@omni-infra/express';
import { Queries } from '@omni-infra/mongoose';

import { resolveSessionBySessionId } from '../-resolve-session';
import { assertSessionResumeAllowed } from '../-agent-run-active';
import { isStageFinished } from '../-stage-status';
import { emitSessionEvent } from '../-session-events';
import type { TResponseVerifyCheckpoint } from '../-api-types';
import type { TParsedStageSnapshot, TVerifyResumeAction, TYahlStage } from '../-types';
import { modelAskUserQuestion, modelStage, modelVerifyCheckpoint } from '../models';
import { yahlStageSchema } from '../stage-schema';
import { spawnOrchestrate } from './spawn-orchestrate';

export type TRequestCreateVerifyCheckpointBody = {
  askUserRef?: string;
  contextSnapshot: Record<string, unknown>;
  feedback: string;
  forkSetupIndex?: number;
  kind?: 'produce_keys' | 'verify';
  loopMeta?: Record<string, unknown>;
  parsedStageSnapshot: TParsedStageSnapshot;
  requestId: string;
  resumeAction?: TVerifyResumeAction;
  score: number;
  stage: TYahlStage;
  stageIndex?: number;
  storageSnapshot: Record<string, unknown>;
  unavailable?: boolean;
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
  askUserRef: Joi.string().trim().optional(),
  contextSnapshot: Joi.object().required(),
  feedback: Joi.string().required(),
  forkSetupIndex: Joi.number().optional(),
  kind: Joi.string().valid('produce_keys', 'verify').optional(),
  loopMeta: Joi.object().optional(),
  parsedStageSnapshot: parsedStageSnapshotSchema.required(),
  requestId: Joi.string().trim().required(),
  resumeAction: Joi.string().valid('rerun', 'edit_answer', 'reask', 'follow_up').optional(),
  score: Joi.number().min(0).max(1).required(),
  stage: yahlStageSchema.required(),
  stageIndex: Joi.number().optional(),
  storageSnapshot: Joi.object().required(),
  unavailable: Joi.boolean().optional(),
});

const editAnswerBodySchema = Joi.object({
  freeText: Joi.string().trim().optional(),
  optionIds: Joi.array().items(Joi.string().trim()).optional(),
}).custom((value, helpers) => {
  const hasOptions = Array.isArray(value.optionIds) && value.optionIds.length > 0;
  const hasFreeText = typeof value.freeText === 'string' && value.freeText.length > 0;

  if (!hasOptions && !hasFreeText) {
    return helpers.error('any.invalid', { message: 'optionIds or freeText is required' });
  }

  if (hasOptions && hasFreeText) {
    return helpers.error('any.invalid', { message: 'optionIds and freeText are mutually exclusive' });
  }

  return value;
});

export const toVerifyCheckpointResponse = (checkpoint: {
  askUserQuestion?: Record<string, unknown>;
  askUserRef?: string;
  editedAnswerFreeText?: string;
  editedAnswerOptionIds?: string[];
  feedback: string;
  kind?: 'produce_keys' | 'verify';
  parsedStageSnapshot?: TParsedStageSnapshot;
  requestId: string;
  resumeAction?: TVerifyResumeAction;
  score: number;
  stage: TYahlStage;
  stageIndex?: number;
  status: 'pending' | 'resumed' | 'superseded';
  storageSnapshot: Record<string, unknown>;
  unavailable?: boolean;
  verifyId: string;
}): TResponseVerifyCheckpoint => ({
  ...(checkpoint.askUserQuestion ? { askUserQuestion: checkpoint.askUserQuestion } : {}),
  ...(checkpoint.askUserRef ? { askUserRef: checkpoint.askUserRef } : {}),
  ...(checkpoint.editedAnswerFreeText ? { editedAnswerFreeText: checkpoint.editedAnswerFreeText } : {}),
  ...(checkpoint.editedAnswerOptionIds?.length
    ? { editedAnswerOptionIds: checkpoint.editedAnswerOptionIds }
    : {}),
  feedback: checkpoint.feedback,
  kind: checkpoint.kind ?? 'verify',
  parsedStageSnapshot: checkpoint.parsedStageSnapshot,
  requestId: checkpoint.requestId,
  ...(checkpoint.resumeAction ? { resumeAction: checkpoint.resumeAction } : {}),
  score: checkpoint.score,
  stage: checkpoint.stage,
  stageIndex: checkpoint.stageIndex,
  status: checkpoint.status,
  storageSnapshot: checkpoint.storageSnapshot,
  ...(checkpoint.unavailable ? { unavailable: true } : {}),
  verifyId: checkpoint.verifyId,
});

const _resolveAnsweredAskUserQuestion = async (
  sessionRef: string,
  requestId: string,
  askUserRef: string,
) => {
  const checkpoints = await Queries.queryBy(modelAskUserQuestion, {
    requestId,
    session: sessionRef,
    status: 'answered',
  }, {
    sort: { createdAt: -1 },
  });

  for (const checkpoint of checkpoints) {
    const batch = checkpoint.batch as {
      questions?: {
        description?: string;
        kind?: string;
        options?: { id: string; label: string }[];
        questionRef: string;
        title?: string;
      }[];
    } | undefined;

    const match = batch?.questions?.find((item) => item.questionRef === askUserRef);

    if (match) {
      return match as Record<string, unknown>;
    }
  }

  return undefined;
};

const verifyPassParamsSchema = Joi.object({
  requestId: Joi.string().trim().required(),
  sessionId: Joi.string().trim().required(),
});

const verifyStartParamsSchema = verifyPassParamsSchema;

const verifyPassBodySchema = Joi.object({
  feedback: Joi.string().allow('').required(),
  score: Joi.number().min(0).max(1).required(),
});

export const isSessionRunActive = (session: { liveViewVncPort?: number | null }) =>
  typeof session.liveViewVncPort === 'number' && session.liveViewVncPort > 0;

export const resolveVerifyStart = [
  Middlewares.Chainable
    .validate(({ req }) => ({
      params: joi.getValidatedOrThrow(verifyStartParamsSchema, req.params),
    }))
    .next(async (express, { params }) => {
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
            updatedAt: now,
            verifyingAt: now,
          },
        },
      );

      emitSessionEvent(params.sessionId, {
        requestId: params.requestId,
        type: 'stage.verifying',
      });

      express.respondOne({ ok: true });
    })
    .toMiddleware(),
];

export const resolveVerifyPass = [
  Middlewares.Chainable
    .validate(({ req }) => ({
      body: joi.getValidatedOrThrow(verifyPassBodySchema, req.body),
      params: joi.getValidatedOrThrow(verifyPassParamsSchema, req.params),
    }))
    .next(async (express, { body, params }) => {
      const session = await resolveSessionBySessionId(params.sessionId);
      const sessionRef = session._id;

      await Queries.hasExactOne(modelStage, {
        requestId: params.requestId,
        session: sessionRef,
      });

      await modelVerifyCheckpoint.updateMany(
        {
          requestId: params.requestId,
          session: sessionRef,
          status: 'pending',
        },
        { $set: { status: 'superseded' } },
      );

      await modelStage.updateOne(
        { requestId: params.requestId, session: sessionRef },
        {
          $set: {
            verifyResult: {
              feedback: body.feedback,
              kind: 'verify',
              pass: true,
              score: body.score,
            },
          },
          $unset: {
            verifyingAt: '',
          },
        },
      );

      emitSessionEvent(params.sessionId, {
        requestId: params.requestId,
        type: 'verify.passed',
      });

      express.respondOne({ ok: true });
    })
    .toMiddleware(),
];

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
      const kind = body.kind ?? 'verify';
      const askUserQuestion = body.askUserRef
        ? await _resolveAnsweredAskUserQuestion(sessionRef, body.requestId, body.askUserRef)
        : undefined;

      await modelVerifyCheckpoint.create({
        ...(askUserQuestion ? { askUserQuestion } : {}),
        ...(body.askUserRef ? { askUserRef: body.askUserRef } : {}),
        contextSnapshot: body.contextSnapshot,
        feedback: body.feedback,
        forkSetupIndex: body.forkSetupIndex,
        kind,
        loopMeta: body.loopMeta,
        parsedStageSnapshot: body.parsedStageSnapshot,
        requestId: body.requestId,
        ...(body.resumeAction ? { resumeAction: body.resumeAction } : {}),
        score: body.score,
        session: sessionRef,
        stage: body.stage,
        ...(body.stageIndex === undefined ? {} : { stageIndex: body.stageIndex }),
        status: 'pending',
        storageSnapshot: body.storageSnapshot,
        ...(body.unavailable ? { unavailable: true } : {}),
        verifyId,
      });

      await modelStage.updateOne(
        { requestId: body.requestId, session: sessionRef },
        {
          $set: {
            verifyResult: {
              feedback: body.feedback,
              kind,
              pass: false,
              score: body.score,
            },
          },
          $unset: {
            finishedAt: '',
            verifyingAt: '',
          },
        },
      );

      emitSessionEvent(params.sessionId, {
        requestId: body.requestId,
        type: kind === 'produce_keys' ? 'produce_keys.failed' : 'verify.failed',
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

      await assertSessionResumeAllowed(session);

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
        await modelStage.updateOne(
          { requestId: checkpoint.requestId, session: sessionRef },
          { $unset: { finishedAt: '' } },
        );
      }

      await modelVerifyCheckpoint.updateOne(
        { verifyId: params.verifyId },
        { $set: { status: 'resumed' } },
      );

      emitSessionEvent(params.sessionId, {
        requestId: checkpoint.requestId,
        type: checkpoint.kind === 'produce_keys' ? 'produce_keys.resumed' : 'verify.resumed',
        verifyId: params.verifyId,
      });

      const resumeFlag = checkpoint.kind === 'produce_keys'
        ? '--produce-keys-resume-id'
        : '--verify-resume-id';

      await spawnOrchestrate(params.sessionId, [resumeFlag, params.verifyId]);

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

      express.respondOne(toVerifyCheckpointResponse(checkpoint));
    })
    .toMiddleware(),
];

export const listVerifyCheckpoints = [
  Middlewares.Chainable
    .validate(({ req }) => ({
      params: joi.getValidatedOrThrow(sessionParamsSchema, req.params),
      query: joi.getValidatedOrThrow(
        Joi.object({ status: Joi.string().valid('pending', 'resumed', 'superseded').optional() }),
        req.query,
      ),
    }))
    .next(async (express, { params, query }) => {
      const session = await resolveSessionBySessionId(params.sessionId);

      const filter: Record<string, unknown> = { session: session._id };

      if (query.status) {
        filter.status = query.status;
      }

      const checkpoints = await Queries.queryBy(modelVerifyCheckpoint, filter, {
        sort: { createdAt: -1 },
      });

      express.respondMany<TResponseVerifyCheckpoint>(
        checkpoints.map((checkpoint) => toVerifyCheckpointResponse(checkpoint)),
      );
    })
    .toMiddleware(),
];

export const editVerifyCheckpointAnswer = [
  Middlewares.Chainable
    .validate(({ req }) => ({
      body: joi.getValidatedOrThrow(editAnswerBodySchema, req.body),
      params: joi.getValidatedOrThrow(verifyParamsSchema, req.params),
    }))
    .next(async (express, { body, params }) => {
      const session = await resolveSessionBySessionId(params.sessionId);
      const sessionRef = session._id;

      await assertSessionResumeAllowed(session);

      const checkpoint = await Queries.hasExactOne(modelVerifyCheckpoint, {
        session: sessionRef,
        status: 'pending',
        verifyId: params.verifyId,
      });

      if (checkpoint.kind === 'produce_keys') {
        throw errors.badRequest('produce_keys checkpoints do not support edit-answer');
      }

      if (checkpoint.resumeAction !== 'edit_answer') {
        throw errors.badRequest('checkpoint resumeAction is not edit_answer');
      }

      const stage = await Queries.hasExactOne(modelStage, {
        requestId: checkpoint.requestId,
        session: sessionRef,
      });

      if (isStageFinished(stage)) {
        await modelStage.updateOne(
          { requestId: checkpoint.requestId, session: sessionRef },
          { $unset: { finishedAt: '' } },
        );
      }

      await modelVerifyCheckpoint.updateOne(
        { verifyId: params.verifyId },
        {
          $set: {
            status: 'resumed',
            ...(body.freeText ? { editedAnswerFreeText: body.freeText } : {}),
            ...(body.optionIds?.length ? { editedAnswerOptionIds: body.optionIds } : {}),
          },
          $unset: {
            ...(body.freeText ? { editedAnswerOptionIds: '' } : {}),
            ...(body.optionIds?.length ? { editedAnswerFreeText: '' } : {}),
          },
        },
      );

      emitSessionEvent(params.sessionId, {
        requestId: checkpoint.requestId,
        type: 'verify.resumed',
        verifyId: params.verifyId,
      });

      await spawnOrchestrate(params.sessionId, ['--verify-resume-id', params.verifyId]);

      express.respondOne({ ok: true, verifyId: params.verifyId });
    })
    .toMiddleware(),
];
