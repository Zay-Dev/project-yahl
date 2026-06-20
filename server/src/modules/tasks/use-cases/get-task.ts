import Joi from 'joi';

import { Middlewares } from '@omni-infra/express';

import type { TResponseTask } from '../-api-types';
import { readTaskFile } from '../-read-task-file';

export type TRequestGetTaskParams = {
  taskId: string;
};

const paramsSchema = Joi.object<TRequestGetTaskParams>({
  taskId: Joi.string().trim().required(),
});

export const getTask = [
  Middlewares.Chainable
    .validate(({ req }) => ({
      params: joi.getValidatedOrThrow(paramsSchema, req.params),
    }))
    .next(async (express, { params }) => {
      try {
        const task = await readTaskFile(params.taskId);

        express.respondOne<TResponseTask>(task);
      } catch {
        throw errors.notFound();
      }
    })
    .toMiddleware(),
];
