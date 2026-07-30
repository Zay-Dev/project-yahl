import config from '@/config';

import '@omni-infra/core';
import '@/core';

import { createLogger } from '@omni-infra/logger-winston';

import fs from 'fs/promises';
import path from 'path';
import url from 'url';
import mongoose from 'mongoose';

import * as Servers from './servers';

declare global {
  var appConfig: typeof config;
}

globalThis.appConfig = config;

const initialize = async () => {
  logger = createLogger();

  try {
    logger.info('Connecting to MongoDB');
    await mongoose.connect(config.mongoDb.url);
    logger.info('Connected to MongoDB');
  } catch (error: unknown) {
    logger.error('Failed to connect to MongoDB', { error: error as Error });
    throw error;
  }
};

const loadModules = async () => {
  const prefix = '@project-yahl/server/modules/';
  const pathToModules = url.pathToFileURL(path.resolve(config.cwd, 'src/modules'));

  const modules = (await fs
    .readdir(pathToModules, { withFileTypes: true }))
    .filter((value) => value.isDirectory())
    .map((value) => value.name);

  const results = await Promise.allSettled(
    modules.map((module) => import(`${prefix}${module}`)),
  );

  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      logger.error(`Load module failed: ${modules[index]}`, {
        error: result.reason as Error,
      });
    }
  });
};

initialize().then(async () => {
  await loadModules();
  Servers.startAll();
});
