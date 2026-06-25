import { randomUUID } from 'crypto';

import Joi from 'joi';

import { Repository } from '@/core';

import { Middlewares } from '@omni-infra/express';

import type { TResponseCreateRun } from '../-api-types';
import { taskExists } from '../-read-task-file';
import { taskYahlRelativePath } from '../-tasks-root';

export type TRequestCreateRunBody = {
  sessionId?: string;
  taskId: string;
};

const bodySchema = Joi.object<TRequestCreateRunBody>({
  sessionId: Joi.string().trim().optional(),
  taskId: Joi.string().trim().required(),
});

export const createRun = [
  Middlewares.Chainable
    .validate(({ req }) => ({
      body: joi.getValidatedOrThrow(bodySchema, req.body),
    }))
    .next(async (express, { body }) => {
      if (!(await taskExists(body.taskId))) {
        throw errors.notFound();
      }

      const sessionId = body.sessionId?.trim() || randomUUID();
      const taskYahlPath = taskYahlRelativePath(body.taskId);

      await Repository.resolve('createPendingSession')({
        sessionId,
        taskId: body.taskId,
        taskYahlPath,
      });

      await Repository.resolve('spawnOrchestrate')(sessionId, ['--task-id', body.taskId]);

      express.res.status(201);
      express.respondOne<TResponseCreateRun>({ sessionId, taskId: body.taskId });
    })
    .toMiddleware(),
];
