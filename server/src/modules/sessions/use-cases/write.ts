import Joi from 'joi';

import type { TTaskSkillFile } from '@project-yahl/shared/yahl/task-skills';

import { Queries } from '@omni-infra/mongoose';
import { Middlewares } from '@omni-infra/express';

import { emitSessionEvent } from '../-session-events';
import type { TParsedStage, TSessionRunCursor } from '../-types';
import { modelSession } from '../models';
import { parsedStageSchema } from '../stage-schema';

export type TRequestRegisterSessionParams = {
  sessionId: string;
};

export type TRequestRegisterSessionBody = {
  liveViewVncPort?: number;
  parsedStages: TParsedStage[];
  resultContextKey?: string;
  taskId: string;
  taskSkills?: TTaskSkillFile[];
  taskYahl: string;
};

export type TResponseRegisterSession = {
  ok: true;
};

export type TRequestPatchSessionBody = {
  liveViewVncPort?: number | null;
  result?: unknown;
  runCursor?: TSessionRunCursor;
};

export type TResponsePatchSession = {
  ok: true;
};

const runCursorSchema = Joi.object<TSessionRunCursor>({
  kind: Joi.string().valid('pipeline', 'repair').required(),
  loopMeta: Joi.any().optional(),
  repairInstruction: Joi.string().trim().optional(),
  stageIndex: Joi.number().integer().min(0).required(),
});

const patchBodySchema = Joi.object<TRequestPatchSessionBody>({
  liveViewVncPort: Joi.number().integer().min(1).max(65535).allow(null).optional(),
  result: Joi.any().optional(),
  runCursor: runCursorSchema.optional(),
});

const taskSkillFileSchema = Joi.object<TTaskSkillFile>({
  content: Joi.string().required(),
  path: Joi.string().trim().min(1).required(),
});

const bodySchema = Joi.object<TRequestRegisterSessionBody>({
  liveViewVncPort: Joi.number().integer().min(1).max(65535).optional(),
  parsedStages: Joi.array().items(parsedStageSchema).min(1).required(),
  resultContextKey: Joi.string().trim().optional(),
  taskId: Joi.string().trim().required(),
  taskSkills: Joi.array().items(taskSkillFileSchema).optional(),
  taskYahl: Joi.string().trim().min(1).required(),
});

const isLiveViewPortOnlyPatch = (body: TRequestPatchSessionBody) =>
  'liveViewVncPort' in body && !('result' in body) && !('runCursor' in body);


const paramsSchema = Joi.object<TRequestRegisterSessionParams>({
  sessionId: Joi.string().trim().required(),
});

export const registerSession = [
  Middlewares.Chainable
    .validate(({ req }) => ({
      body: joi.getValidatedOrThrow(bodySchema, req.body),
      params: joi.getValidatedOrThrow(paramsSchema, req.params),
    }))
    .next(async (express, { body, params }) => {
      const now = new Date();

      await modelSession.updateOne(
        { sessionId: params.sessionId },
        {
          $set: {
            parsedStages: body.parsedStages,
            taskId: body.taskId,
            taskSkills: body.taskSkills ?? [],
            taskYahl: body.taskYahl,
            updatedAt: now,
            ...(body.resultContextKey ? { resultContextKey: body.resultContextKey } : {}),
            ...(body.liveViewVncPort ? { liveViewVncPort: body.liveViewVncPort } : {}),
          },
          $setOnInsert: {
            sessionId: params.sessionId,
          },
        },
        { upsert: true },
      );

      emitSessionEvent(params.sessionId, { type: 'session.updated' });

      express.res.status(202);
      express.respondOne<TResponseRegisterSession>({ ok: true });
    })
    .toMiddleware(),
];

export const patchSession = [
  Middlewares.Chainable
    .validate(({ req }) => ({
      body: joi.getValidatedOrThrow(patchBodySchema, req.body),
      params: joi.getValidatedOrThrow(paramsSchema, req.params),
    }))
    .next(async (express, { body, params }) => {
      const now = new Date();

      if (isLiveViewPortOnlyPatch(body)) {
        await modelSession.updateOne(
          { sessionId: params.sessionId },
          {
            $set: {
              liveViewVncPort: body.liveViewVncPort,
              updatedAt: now,
            },
            $setOnInsert: {
              sessionId: params.sessionId,
            },
          },
          { upsert: true },
        );
      } else {
        await Queries.hasExactOne(modelSession, { sessionId: params.sessionId });

        await modelSession.updateOne(
          { sessionId: params.sessionId },
          {
            $set: {
              ...('result' in body ? { result: body.result } : {}),
              ...('liveViewVncPort' in body ? { liveViewVncPort: body.liveViewVncPort } : {}),
              ...('runCursor' in body && body.runCursor ? { runCursor: body.runCursor } : {}),
              updatedAt: now,
            },
          },
        );
      }

      emitSessionEvent(params.sessionId, { type: 'session.updated' });

      express.respondOne<TResponsePatchSession>({ ok: true });
    })
    .toMiddleware(),
];
