import { randomUUID } from 'crypto';

import { validateRunInputPayload } from '@project-yahl/shared/yahl/run-input-keys';

import Joi from 'joi';

import { Repository } from '@/core';

import { Middlewares } from '@omni-infra/express';

import type { TResponseCreateRun } from '../-api-types';
import { readTaskFile, taskExists } from '../-read-task-file';
import { readTaskSkillsFromDisk } from '../-read-task-skills';

export type TRequestCreateRunBody = {
  runInput?: Record<string, unknown>;
  sessionId?: string;
  taskId: string;
};

const bodySchema = Joi.object<TRequestCreateRunBody>({
  runInput: Joi.object().optional(),
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
      const task = await readTaskFile(body.taskId);
      const validation = validateRunInputPayload(body.runInput, task.runInputKeys);

      if (!validation.ok) {
        throw errors.badRequest(validation.message);
      }

      const taskSkills = await readTaskSkillsFromDisk(body.taskId);

      await Repository.resolve('createPendingSession')({
        isBackground: task.background === true,
        runInput: body.runInput,
        sessionId,
        taskId: body.taskId,
        taskSkills,
        taskYahl: task.yahl,
      });

      await Repository.resolve('spawnOrchestrate')(sessionId, ['--task-id', body.taskId]);

      express.res.status(201);
      express.respondOne<TResponseCreateRun>({ sessionId, taskId: body.taskId });
    })
    .toMiddleware(),
];
