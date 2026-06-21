import fs from 'fs/promises';
import path from 'path';

import Joi from 'joi';

import { Middlewares } from '@omni-infra/express';

import type { TResponseCreateTask } from '../-api-types';
import { taskExists } from '../-read-task-file';
import { resolveTasksRoot } from '../-tasks-root';

export type TRequestCreateTaskBody = {
  taskId: string;
  yahl: string;
};

const bodySchema = Joi.object<TRequestCreateTaskBody>({
  taskId: Joi.string().trim().pattern(/^[a-z0-9_-]+$/i).required(),
  yahl: Joi.string().trim().min(1).required(),
});

export const createTask = [
  Middlewares.Chainable
    .validate(({ req }) => ({
      body: joi.getValidatedOrThrow(bodySchema, req.body),
    }))
    .next(async (express, { body }) => {
      if (await taskExists(body.taskId)) {
        throw errors.conflict('Task already exists');
      }

      const taskDir = path.join(resolveTasksRoot(), body.taskId);

      await fs.mkdir(taskDir, { recursive: true });
      await fs.writeFile(path.join(taskDir, 'SKILL.yahl'), body.yahl, 'utf8');

      express.res.status(201);
      express.respondOne<TResponseCreateTask>({ ok: true, taskId: body.taskId });
    })
    .toMiddleware(),
];
