import Joi from 'joi';

import { Middlewares } from '@omni-infra/express';
import { Queries } from '@omni-infra/mongoose';

import { resolveSessionBySessionId } from '../-resolve-session';
import { modelAskUserQuestion } from '../models';

export type TResponseAskUserQuestion = {
  answerIds?: string[];
  answerLabels?: string[];
  askUserId: string;
  contextSnapshot: Record<string, unknown>;
  forkSetupIndex?: number;
  freeText?: string;
  loopMeta?: Record<string, unknown>;
  options: { id: string; label: string }[];
  parsedStageSnapshot?: {
    lines: string;
    sourceStartLine: number;
    type: 'loop' | 'plain';
  };
  question: Record<string, unknown>;
  questionId: string;
  questionRef: string;
  requestId: string;
  stage: Record<string, unknown>;
  stageIndex?: number;
  status: 'answered' | 'pending';
  storageSnapshot: Record<string, unknown>;
  toolCallId: string;
};

export type TResponseAskUserQuestionListItem = {
  question: Record<string, unknown>;
  questionId: string;
  questionRef: string;
  requestId: string;
  status: 'answered' | 'pending';
};

const sessionParamsSchema = Joi.object({
  sessionId: Joi.string().trim().required(),
});

const questionParamsSchema = Joi.object({
  questionId: Joi.string().trim().required(),
  sessionId: Joi.string().trim().required(),
});

const _toCheckpoint = (question: {
  answerIds?: string[];
  answerLabels?: string[];
  askUserId: string;
  contextSnapshot: Record<string, unknown>;
  forkSetupIndex?: number;
  freeText?: string;
  loopMeta?: Record<string, unknown>;
  question: Record<string, unknown>;
  parsedStageSnapshot?: {
    lines: string;
    sourceStartLine: number;
    type: 'loop' | 'plain';
  };
  questionId: string;
  questionRef: string;
  requestId: string;
  stage: Record<string, unknown>;
  stageIndex?: number;
  status: 'answered' | 'pending';
  storageSnapshot: Record<string, unknown>;
  toolCallId: string;
}): TResponseAskUserQuestion => {
  const questionArgs = question.question as {
    options?: { id: string; label: string }[];
  };

  return {
    answerIds: question.answerIds,
    answerLabels: question.answerLabels,
    askUserId: question.askUserId,
    contextSnapshot: question.contextSnapshot,
    forkSetupIndex: question.forkSetupIndex,
    freeText: question.freeText,
    loopMeta: question.loopMeta,
    options: questionArgs.options ?? [],
    question: question.question,
    parsedStageSnapshot: question.parsedStageSnapshot,
    questionId: question.questionId,
    questionRef: question.questionRef,
    requestId: question.requestId,
    stage: question.stage,
    stageIndex: question.stageIndex,
    status: question.status,
    storageSnapshot: question.storageSnapshot,
    toolCallId: question.toolCallId,
  };
};

export const listAskUserQuestions = [
  Middlewares.Chainable
    .validate(({ req }) => ({
      params: joi.getValidatedOrThrow(sessionParamsSchema, req.params),
      query: joi.getValidatedOrThrow(
        Joi.object({ status: Joi.string().valid('pending', 'answered').optional() }),
        req.query,
      ),
    }))
    .next(async (express, { params, query }) => {
      const session = await resolveSessionBySessionId(params.sessionId);

      const filter: Record<string, unknown> = { session: session._id };

      if (query.status) {
        filter.status = query.status;
      }

      const questions = await Queries.queryBy(modelAskUserQuestion, filter, {
        sort: { createdAt: -1 },
      });

      express.respondMany<TResponseAskUserQuestionListItem>(
        questions.map((question) => ({
          question: question.question,
          questionId: question.questionId,
          questionRef: question.questionRef,
          requestId: question.requestId,
          status: question.status,
        })),
      );
    })
    .toMiddleware(),
];

export const getAskUserQuestion = [
  Middlewares.Chainable
    .validate(({ req }) => ({
      params: joi.getValidatedOrThrow(questionParamsSchema, req.params),
    }))
    .next(async (express, { params }) => {
      const session = await resolveSessionBySessionId(params.sessionId);

      const question = await Queries.hasExactOne(modelAskUserQuestion, {
        questionId: params.questionId,
        session: session._id,
      });

      express.respondOne<TResponseAskUserQuestion>(_toCheckpoint(question));
    })
    .toMiddleware(),
];
