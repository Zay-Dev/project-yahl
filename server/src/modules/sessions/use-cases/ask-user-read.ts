import Joi from 'joi';

import { Middlewares } from '@omni-infra/express';
import { Queries } from '@omni-infra/mongoose';

import { resolveSessionBySessionId } from '../-resolve-session';
import type { TResponsePendingAskUserQuestion } from '../-api-types';
import { modelAskUserQuestion, modelSession } from '../models';

export type TResponseAskUserQuestion = {
  batch?: Record<string, unknown>;
  batchAnswers?: {
    answerValue: unknown;
    freeText?: string;
    optionIds?: string[];
    questionRef: string;
  }[];
  batchId?: string;
  contextSnapshot: Record<string, unknown>;
  forkSetupIndex?: number;
  loopMeta?: Record<string, unknown>;
  parsedStageSnapshot?: {
    lines: string;
    sourceStartLine: number;
    type: 'loop' | 'plain' | 'while';
  };
  questionId: string;
  requestId: string;
  stage: Record<string, unknown>;
  stageIndex?: number;
  status: 'answered' | 'pending' | 'superseded';
  storageSnapshot: Record<string, unknown>;
  toolCallId: string;
};

export type TResponseAskUserQuestionListItem = {
  batch?: Record<string, unknown>;
  batchId?: string;
  questionCount?: number;
  questionId: string;
  requestId: string;
  status: 'answered' | 'pending' | 'superseded';
  title?: string;
};

const sessionParamsSchema = Joi.object({
  sessionId: Joi.string().trim().required(),
});

const questionParamsSchema = Joi.object({
  questionId: Joi.string().trim().required(),
  sessionId: Joi.string().trim().required(),
});

const _toCheckpoint = (question: {
  batch?: Record<string, unknown>;
  batchAnswers?: TResponseAskUserQuestion['batchAnswers'];
  batchId?: string;
  contextSnapshot: Record<string, unknown>;
  forkSetupIndex?: number;
  loopMeta?: Record<string, unknown>;
  parsedStageSnapshot?: {
    lines: string;
    sourceStartLine: number;
    type: 'loop' | 'plain' | 'while';
  };
  questionId: string;
  requestId: string;
  stage: Record<string, unknown>;
  stageIndex?: number;
  status: 'answered' | 'pending' | 'superseded';
  storageSnapshot: Record<string, unknown>;
  toolCallId: string;
}): TResponseAskUserQuestion => ({
  batch: question.batch,
  batchAnswers: question.batchAnswers,
  batchId: question.batchId,
  contextSnapshot: question.contextSnapshot,
  forkSetupIndex: question.forkSetupIndex,
  loopMeta: question.loopMeta,
  parsedStageSnapshot: question.parsedStageSnapshot,
  questionId: question.questionId,
  requestId: question.requestId,
  stage: question.stage,
  stageIndex: question.stageIndex,
  status: question.status,
  storageSnapshot: question.storageSnapshot,
  toolCallId: question.toolCallId,
});

export const listAskUserQuestions = [
  Middlewares.Chainable
    .validate(({ req }) => ({
      params: joi.getValidatedOrThrow(sessionParamsSchema, req.params),
      query: joi.getValidatedOrThrow(
        Joi.object({ status: Joi.string().valid('pending', 'answered', 'superseded').optional() }),
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
        questions.map((question) => {
          const batch = question.batch as { questions?: unknown[]; title?: string } | undefined;

          return {
            batch: question.batch,
            batchId: question.batchId,
            questionCount: batch?.questions?.length,
            questionId: question.questionId,
            requestId: question.requestId,
            status: question.status,
            title: batch?.title,
          };
        }),
      );
    })
    .toMiddleware(),
];

export const listPendingAskUserQuestions = [
  Middlewares.Chainable
    .next(async (express) => {
      const questions = await Queries.queryBy(modelAskUserQuestion, { status: 'pending' }, {
        sort: { createdAt: -1 },
      });

      const sessionRefs = [...new Set(questions.map((question) => String(question.session)))];
      const sessions = sessionRefs.length
        ? await Queries.queryBy(modelSession, { _id: { $in: sessionRefs } })
        : [];
      const sessionByRef = new Map(sessions.map((session) => [String(session._id), session]));

      express.respondMany<TResponsePendingAskUserQuestion>(
        questions.map((question) => {
          const session = sessionByRef.get(String(question.session));
          const batch = question.batch as { questions?: unknown[]; title?: string } | undefined;

          return {
            batch: question.batch,
            batchId: question.batchId,
            questionCount: batch?.questions?.length,
            questionId: question.questionId,
            requestId: question.requestId,
            sessionId: session?.sessionId ?? String(question.session),
            status: question.status,
            taskId: session?.taskId,
            title: batch?.title,
          };
        }),
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
