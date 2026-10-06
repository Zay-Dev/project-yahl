import type {
  TRequestRestartEnvOverrideBody,
  TResponseRestartEnvOverride,
} from '../-api-types';

import { spawn } from 'node:child_process';
import path from 'node:path';

import Joi from 'joi';

import { Middlewares } from '@omni-infra/express';

import { Repository } from '@/core';

const bodySchema = Joi.object<TRequestRestartEnvOverrideBody>({
  confirmRunning: Joi.boolean().optional(),
});

const scheduleComposeRestart = (): void => {
  const hostRoot = process.env.HOST_REPO_ROOT?.trim();

  if (!hostRoot) {
    throw errors.custom('HOST_REPO_ROOT is required to restart compose services', 503);
  }

  const composeFile = path.join(hostRoot, 'docker-compose.yml');

  setTimeout(() => {
    const child = spawn(
      'docker',
      ['compose', '-f', composeFile, 'restart', 'worker', 'server'],
      {
        cwd: hostRoot,
        detached: true,
        stdio: 'ignore',
      },
    );

    child.unref();
  }, 400);
};

export const restartEnvOverrideServices = [
  Middlewares.Chainable
    .validate(({ req }) => ({
      body: joi.getValidatedOrThrow(bodySchema, req.body ?? {}),
    }))
    .next(async (express, { body }) => {
      const activeSessionCount = await Repository.resolve('countActiveSessionRuns')();

      if (activeSessionCount > 0 && body.confirmRunning !== true) {
        throw errors.conflict(
          `${activeSessionCount} running task${activeSessionCount === 1 ? '' : 's'}; confirm to restart`,
        );
      }

      scheduleComposeRestart();
      express.res.status(202);
      express.respondOne<TResponseRestartEnvOverride>({ ok: true });
    })
    .toMiddleware(),
];
