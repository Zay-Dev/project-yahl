import { randomUUID } from 'crypto';

import Joi from 'joi';

import { Middlewares } from '@omni-infra/express';
import { Queries } from '@omni-infra/mongoose';

import { resolveSessionBySessionId } from '../-resolve-session';
import { isStageFinished } from '../-stage-status';
import { emitSessionEvent } from '../-session-events';
import type { TParsedStageSnapshot, TYahlStage } from '../-types';
import { modelAskUserQuestion, modelStage } from '../models';
import { yahlStageSchema } from '../stage-schema';
import { spawnOrchestrate } from './spawn-orchestrate';

export type TRequestCreateAskUserQuestionBody = {
  askUserId: number | string;
  contextSnapshot: Record<string, unknown>;
  forkSetupIndex?: number;
  loopMeta?: Record<string, unknown>;
  parsedStageSnapshot: TParsedStageSnapshot;
  question: Record<string, unknown>;
  questionRef: string;
  requestId: string;
  stage: TYahlStage;
  stageIndex?: number;
  storageSnapshot: Record<string, unknown>;
  toolCallId: string;
};

export type TRequestAnswerAskUserQuestionBody = {
  freeText?: string;
  optionIds?: string[];
};

export type TResponseCreateAskUserQuestion = {
  questionId: string;
};

export type TResponseAnswerAskUserQuestion = {
  ok: true;
  questionId: string;
};

const sessionParamsSchema = Joi.object({
  sessionId: Joi.string().trim().required(),
});

const questionParamsSchema = Joi.object({
  questionId: Joi.string().trim().required(),
  sessionId: Joi.string().trim().required(),
});

const parsedStageSnapshotSchema = Joi.object<TParsedStageSnapshot>({
  lines: Joi.string().required(),
  sourceStartLine: Joi.number().integer().min(1).required(),
  type: Joi.string().valid('loop', 'plain').required(),
});

const createBodySchema = Joi.object<TRequestCreateAskUserQuestionBody>({
  askUserId: Joi.alternatives().try(Joi.number(), Joi.string().trim()).required(),
  contextSnapshot: Joi.object().required(),
  forkSetupIndex: Joi.number().optional(),
  loopMeta: Joi.object().optional(),
  parsedStageSnapshot: parsedStageSnapshotSchema.required(),
  question: Joi.object().required(),
  questionRef: Joi.string().trim().required(),
  requestId: Joi.string().trim().required(),
  stage: yahlStageSchema.required(),
  stageIndex: Joi.number().optional(),
  storageSnapshot: Joi.object().required(),
  toolCallId: Joi.string().trim().required(),
});

const answerBodySchema = Joi.object<TRequestAnswerAskUserQuestionBody>({
  freeText: Joi.string().trim().optional(),
  optionIds: Joi.array().items(Joi.string().trim()).optional(),
})
  .custom((value, helpers) => {
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

const _sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const _assertStageRunning = async (sessionRef: string, requestId: string) => {
  const maxAttempts = 20;
  const delayMs = 100;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const matches = await Queries.queryBy(modelStage, {
      requestId,
      session: sessionRef,
    });

    if (matches.length === 1) {
      const stage = matches[0]!;

      if (isStageFinished(stage)) {
        throw errors.badRequest('ask-user is only allowed while stage is running');
      }

      return stage;
    }

    if (attempt < maxAttempts - 1) {
      await _sleep(delayMs);
    }
  }

  throw errors.notFound('stage not found for ask-user (stage.created may still be pending)');
};

const _patchStageAskUserAnswer = async (
  sessionRef: string,
  requestId: string,
  askUserId: number | string,
  answer: number | string,
) => {
  const stage = await Queries.hasExactOne(modelStage, {
    requestId,
    session: sessionRef,
  });

  const askUser = stage.stage.askUser?.map((entry) => (
    String(entry.id) === String(askUserId)
      ? { ...entry, answer }
      : entry
  ));

  await modelStage.updateOne(
    { requestId, session: sessionRef },
    {
      $set: {
        stage: {
          ...stage.stage,
          ...(askUser ? { askUser } : {}),
        },
      },
      $unset: {
        contextAfter: '',
        finishedAt: '',
      },
    },
  );
};

export const createAskUserQuestion = [
  Middlewares.Chainable
    .validate(({ req }) => ({
      body: joi.getValidatedOrThrow(createBodySchema, req.body),
      params: joi.getValidatedOrThrow(sessionParamsSchema, req.params),
    }))
    .next(async (express, { body, params }) => {
      const session = await resolveSessionBySessionId(params.sessionId);
      const sessionRef = session._id;

      await _assertStageRunning(sessionRef, body.requestId);

      const questionId = randomUUID();

      await modelAskUserQuestion.create({
        askUserId: body.askUserId,
        contextSnapshot: body.contextSnapshot,
        forkSetupIndex: body.forkSetupIndex,
        loopMeta: body.loopMeta,
        question: body.question,
        parsedStageSnapshot: body.parsedStageSnapshot,
        questionId,
        questionRef: body.questionRef,
        requestId: body.requestId,
        session: sessionRef,
        stage: body.stage,
        ...(body.stageIndex === undefined ? {} : { stageIndex: body.stageIndex }),
        status: 'pending',
        storageSnapshot: body.storageSnapshot,
        toolCallId: body.toolCallId,
      });

      emitSessionEvent(params.sessionId, {
        questionId,
        requestId: body.requestId,
        type: 'ask-user.created',
      });

      express.res.status(201);
      express.respondOne<TResponseCreateAskUserQuestion>({ questionId });
    })
    .toMiddleware(),
];

export const answerAskUserQuestion = [
  Middlewares.Chainable
    .validate(({ req }) => ({
      body: joi.getValidatedOrThrow(answerBodySchema, req.body),
      params: joi.getValidatedOrThrow(questionParamsSchema, req.params),
    }))
    .next(async (express, { body, params }) => {
      const session = await resolveSessionBySessionId(params.sessionId);
      const sessionRef = session._id;

      const question = await Queries.hasExactOne(modelAskUserQuestion, {
        questionId: params.questionId,
        session: sessionRef,
      });

      if (question.status === 'answered') {
        throw errors.badRequest('question already answered');
      }

      await _assertStageRunning(sessionRef, question.requestId);

      const questionArgs = question.question as {
        options?: { id: string; label: string }[];
      };
      const options = questionArgs.options ?? [];
      const optionIds = body.optionIds ?? [];
      const answerLabels = options
        .filter((option) => optionIds.includes(option.id))
        .map((option) => option.label);

      const answerValue = body.freeText?.trim()
        || (() => {
          const id = optionIds[0] ?? '';
          if (/^-?(?:\d+|\d*\.\d+)$/.test(id)) {
            const asNumber = Number(id);
            if (Number.isFinite(asNumber)) return asNumber;
          }
          return id;
        })();

      await modelAskUserQuestion.updateOne(
        { _id: question._id },
        {
          $set: {
            ...(optionIds.length ? { answerIds: optionIds } : {}),
            ...(answerLabels.length ? { answerLabels } : {}),
            ...(body.freeText ? { freeText: body.freeText.trim() } : {}),
            answeredAt: new Date(),
            status: 'answered',
          },
        },
      );

      await _patchStageAskUserAnswer(
        sessionRef,
        question.requestId,
        question.askUserId,
        answerValue,
      );

      emitSessionEvent(params.sessionId, {
        questionId: params.questionId,
        requestId: question.requestId,
        type: 'ask-user.answered',
      });

      spawnOrchestrate(params.sessionId, ['--resume-id', params.questionId]);

      express.respondOne<TResponseAnswerAskUserQuestion>({
        ok: true,
        questionId: params.questionId,
      });
    })
    .toMiddleware(),
];
