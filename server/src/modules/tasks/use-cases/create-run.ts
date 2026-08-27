import { randomUUID } from 'crypto';
import path from 'path';

import {
  applyRunInputDefaults,
  validateRunInputPayload,
} from '@project-yahl/shared/yahl/run-input-keys';
import { parseYahlTask } from '@project-yahl/shared/yahl/parse-task';

import Joi from 'joi';

import { Repository } from '@/core';


import { Middlewares } from '@omni-infra/express';

import type { TResponseCreateRun } from '../-api-types';
import { readTaskFile, taskExists } from '../-read-task-file';
import { readTaskSkillsFromDisk } from '../-read-task-skills';
import { taskYahlAbsolutePath } from '../-tasks-root';

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
      const runInput = applyRunInputDefaults(body.runInput, task.runInputFields);
      const validation = validateRunInputPayload(runInput, task.runInputFields);

      if (!validation.ok) {
        throw errors.badRequest(validation.message);
      }

      const taskSkills = await readTaskSkillsFromDisk(body.taskId);
      const taskRoot = path.dirname(taskYahlAbsolutePath(body.taskId));
      const { resultContextKey, stages, yahlRefs } = parseYahlTask(task.yahl, {
        taskRoot,
      });

      await Repository.resolve('createPendingSession')({
        isBackground: task.background === true,
        parsedStages: stages,
        resultContextKey,
        runCursor: { kind: 'pipeline', stageIndex: 0 },
        runInput,
        sessionId,
        storageSeed: { context: {}, types: {} },
        taskId: body.taskId,
        taskSkills,
        taskYahl: task.yahl,
        ...(yahlRefs ? { taskYahlRefs: yahlRefs } : {}),
      });

      await Repository.resolve('spawnOrchestrate')(sessionId, []);

      express.res.status(201);
      express.respondOne<TResponseCreateRun>({ sessionId, taskId: body.taskId });
    })
    .toMiddleware(),
];
