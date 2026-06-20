import fs from 'fs/promises';

import Joi from 'joi';

import { Middlewares } from '@omni-infra/express';

import type { TResponseUpdateTask } from '../-api-types';
import { taskExists } from '../-read-task-file';
import { taskYahlAbsolutePath } from '../-tasks-root';

export type TRequestUpdateTaskParams = {
  taskId: string;
};

export type TRequestUpdateTaskBody = {
  yahl: string;
};

const paramsSchema = Joi.object<TRequestUpdateTaskParams>({
  taskId: Joi.string().trim().required(),
});

const bodySchema = Joi.object<TRequestUpdateTaskBody>({
  yahl: Joi.string().trim().min(1).required(),
});

export const updateTask = [
  Middlewares.Chainable
    .validate(({ req }) => ({
      body: joi.getValidatedOrThrow(bodySchema, req.body),
      params: joi.getValidatedOrThrow(paramsSchema, req.params),
    }))
    .next(async (express, { body, params }) => {
      if (!(await taskExists(params.taskId))) {
        throw errors.notFound();
      }

      await fs.writeFile(taskYahlAbsolutePath(params.taskId), body.yahl, 'utf8');

      express.respondOne<TResponseUpdateTask>({ ok: true, taskId: params.taskId });
    })
    .toMiddleware(),
];
