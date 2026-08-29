import { randomUUID } from 'crypto';

import Joi from 'joi';

import { Middlewares } from '@omni-infra/express';
import { Queries } from '@omni-infra/mongoose';

import { assertSessionRunAllowed } from '../-agent-run-active';
import { resolveSessionBySessionId } from '../-resolve-session';
import { isStageFinished } from '../-stage-status';
import { emitSessionEvent } from '../-session-events';
import type {
  TAskUserBatchAnswerRecord,
  TParsedStageSnapshot,
  TYahlStage,
} from '../-types';
import { modelAskUserQuestion, modelStage } from '../models';
import { parsedStageSnapshotSchema, yahlStageSchema } from '../stage-schema';
import { spawnOrchestrate } from './spawn-orchestrate';

export type TAskUserBatchQuestionInput = {
  allowMultiple?: boolean;
  description?: string;
  kind: 'multipleChoice' | 'text';
  maxChoices?: number;
  minChoices?: number;
  options?: { description?: string; id: string; label: string }[];
  placeholder?: string;
  questionRef: string;
  title: string;
};

export type TRequestCreateAskUserBatchBody = {
  batch: {
    batchId: string;
    description?: string;
    questions: TAskUserBatchQuestionInput[];
    title: string;
    version: 'askUserBatch.v1';
  };
  batchId: string;
  contextSnapshot: Record<string, unknown>;
  forkSetupIndex?: number;
  loopMeta?: Record<string, unknown>;
  parsedStageSnapshot: TParsedStageSnapshot;
  requestId: string;
  stage: TYahlStage;
  stageIndex?: number;
  storageSnapshot: Record<string, unknown>;
  toolCallId: string;
};

export type TRequestAnswerAskUserBatchBody = {
  answers: {
    freeText?: string;
    optionIds?: string[];
    questionRef: string;
  }[];
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

const batchParamsSchema = Joi.object({
  batchId: Joi.string().trim().required(),
  sessionId: Joi.string().trim().required(),
});

const questionParamsSchema = Joi.object({
  questionId: Joi.string().trim().required(),
  sessionId: Joi.string().trim().required(),
});

const batchQuestionSchema = Joi.object<TAskUserBatchQuestionInput>({
  allowMultiple: Joi.boolean().optional(),
  description: Joi.string().optional(),
  kind: Joi.string().valid('multipleChoice', 'text').required(),
  maxChoices: Joi.number().optional(),
  minChoices: Joi.number().optional(),
  options: Joi.array().items(Joi.object({
    description: Joi.string().optional(),
    id: Joi.string().trim().required(),
    label: Joi.string().trim().required(),
  })).optional(),
  placeholder: Joi.string().optional(),
  questionRef: Joi.string().trim().required(),
  title: Joi.string().trim().required(),
});

const createBatchBodySchema = Joi.object<TRequestCreateAskUserBatchBody>({
  batch: Joi.object({
    batchId: Joi.string().trim().required(),
    description: Joi.string().optional(),
    questions: Joi.array().items(batchQuestionSchema).min(1).required(),
    title: Joi.string().trim().required(),
    version: Joi.string().valid('askUserBatch.v1').required(),
  }).required(),
  batchId: Joi.string().trim().required(),
  contextSnapshot: Joi.object().required(),
  forkSetupIndex: Joi.number().optional(),
  loopMeta: Joi.object().optional(),
  parsedStageSnapshot: parsedStageSnapshotSchema.required(),
  requestId: Joi.string().trim().required(),
  stage: yahlStageSchema.required(),
  stageIndex: Joi.number().optional(),
  storageSnapshot: Joi.object().required(),
  toolCallId: Joi.string().trim().required(),
});

const answerItemSchema = Joi.object({
  freeText: Joi.string().trim().optional(),
  optionIds: Joi.array().items(Joi.string().trim()).optional(),
  questionRef: Joi.string().trim().required(),
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

const answerBatchBodySchema = Joi.object<TRequestAnswerAskUserBatchBody>({
  answers: Joi.array().items(answerItemSchema).min(1).required(),
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

const _resolveAnswerValue = (
  optionIds: string[] | undefined,
  freeText: string | undefined,
): number | string | string[] => {
  if (freeText?.trim()) {
    return freeText.trim();
  }

  const ids = optionIds ?? [];

  if (ids.length > 1) {
    return ids;
  }

  const id = ids[0] ?? '';

  if (/^-?(?:\d+|\d*\.\d+)$/.test(id)) {
    const asNumber = Number(id);
    if (Number.isFinite(asNumber)) return asNumber;
  }

  return id;
};

const _patchStageAskUserAnswers = async (
  sessionRef: string,
  requestId: string,
  answers: TAskUserBatchAnswerRecord[],
) => {
  const stage = await Queries.hasExactOne(modelStage, {
    requestId,
    session: sessionRef,
  });

  let nextStage = stage.stage;

  for (const answer of answers) {
    const askUser = nextStage.askUser?.map((entry) => (
      String(entry.id) === answer.questionRef
        ? { ...entry, answer: answer.answerValue }
        : entry
    ));

    nextStage = {
      ...nextStage,
      ...(askUser ? { askUser } : {}),
    };
  }

  await modelStage.updateOne(
    { requestId, session: sessionRef },
    {
      $set: {
        stage: nextStage,
      },
      $unset: {
        contextAfter: '',
        finishedAt: '',
      },
    },
  );
};

export const createAskUserBatch = [
  Middlewares.Chainable
    .validate(({ req }) => ({
      body: joi.getValidatedOrThrow(createBatchBodySchema, req.body),
      params: joi.getValidatedOrThrow(sessionParamsSchema, req.params),
    }))
    .next(async (express, { body, params }) => {
      const session = await resolveSessionBySessionId(params.sessionId);
      const sessionRef = session._id;

      await _assertStageRunning(sessionRef, body.requestId);

      const questionId = randomUUID();

      await modelAskUserQuestion.create({
        batch: body.batch,
        batchId: body.batchId,
        contextSnapshot: body.contextSnapshot,
        forkSetupIndex: body.forkSetupIndex,
        loopMeta: body.loopMeta,
        parsedStageSnapshot: body.parsedStageSnapshot,
        questionId,
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

export const answerAskUserBatch = [
  Middlewares.Chainable
    .validate(({ req }) => ({
      body: joi.getValidatedOrThrow(answerBatchBodySchema, req.body),
      params: joi.getValidatedOrThrow(batchParamsSchema, req.params),
    }))
    .next(async (express, { body, params }) => {
      const session = await resolveSessionBySessionId(params.sessionId);
      const sessionRef = session._id;

      await assertSessionRunAllowed({
        _id: String(sessionRef),
        browserAbandonedAt: session.browserAbandonedAt,
        liveViewVncPort: session.liveViewVncPort,
        sessionId: session.sessionId,
      });

      const checkpoint = await Queries.hasExactOne(modelAskUserQuestion, {
        batchId: params.batchId,
        session: sessionRef,
        status: 'pending',
      });

      if (checkpoint.status === 'answered') {
        throw errors.badRequest('batch already answered');
      }

      await _assertStageRunning(sessionRef, checkpoint.requestId);

      const batch = checkpoint.batch as TRequestCreateAskUserBatchBody['batch'] | undefined;

      if (!batch?.questions?.length) {
        throw errors.badRequest('invalid batch checkpoint');
      }

      const expectedRefs = new Set(batch.questions.map((item) => item.questionRef));
      const answeredRefs = new Set(body.answers.map((item) => item.questionRef));

      if (expectedRefs.size !== answeredRefs.size) {
        throw errors.badRequest('all batch questions must be answered');
      }

      for (const ref of expectedRefs) {
        if (!answeredRefs.has(ref)) {
          throw errors.badRequest(`missing answer for ${ref}`);
        }
      }

      const batchAnswers: TAskUserBatchAnswerRecord[] = body.answers.map((answer) => {
        const question = batch.questions.find((item) => item.questionRef === answer.questionRef)!;
        const optionIds = answer.optionIds ?? [];
        const freeText = answer.freeText?.trim();

        if (question.kind === 'multipleChoice' && question.allowMultiple && !freeText) {
          const minChoices = question.minChoices ?? 1;

          if (optionIds.length < minChoices) {
            throw errors.badRequest(`question ${answer.questionRef} requires at least ${minChoices} choices`);
          }
        }

        if (question.kind === 'multipleChoice' && !question.allowMultiple && !freeText && optionIds.length !== 1) {
          throw errors.badRequest(`question ${answer.questionRef} requires exactly one choice`);
        }

        return {
          answerValue: _resolveAnswerValue(optionIds, freeText),
          ...(freeText ? { freeText } : {}),
          ...(optionIds.length ? { optionIds } : {}),
          questionRef: answer.questionRef,
        };
      });

      await modelAskUserQuestion.updateOne(
        { _id: checkpoint._id },
        {
          $set: {
            batchAnswers,
            status: 'answered',
          },
        },
      );

      await _patchStageAskUserAnswers(sessionRef, checkpoint.requestId, batchAnswers);

      emitSessionEvent(params.sessionId, {
        questionId: checkpoint.questionId,
        requestId: checkpoint.requestId,
        type: 'ask-user.answered',
      });

      console.log(
        `[yahl-diag] ask-user answer spawning resume questionId=${checkpoint.questionId} sessionId=${params.sessionId} requestId=${checkpoint.requestId}`,
      );

      await spawnOrchestrate(params.sessionId, ['--resume-id', checkpoint.questionId]);

      express.respondOne<TResponseAnswerAskUserQuestion>({
        ok: true,
        questionId: checkpoint.questionId,
      });
    })
    .toMiddleware(),
];

export const answerAskUserQuestion = answerAskUserBatch;
export const createAskUserQuestion = createAskUserBatch;
