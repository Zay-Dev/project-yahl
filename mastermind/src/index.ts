import 'dotenv/config';

import fs from 'fs/promises';
import path from 'path';

import { reportProcessLevelCrash } from './-crash-reports/index.js';
import { paths } from './config.js';
import { createApiServer } from './-api/server.js';
import { createMastermindAgent } from './-sdk/agent.js';

const ensureDataDirs = async () => {
  await Promise.all([
    fs.mkdir(paths.crashReports, { recursive: true }),
    fs.mkdir(paths.knowledges, { recursive: true }),
    fs.mkdir(paths.rules, { recursive: true }),
    fs.mkdir(path.join(paths.rules, 'verify'), { recursive: true }),
    fs.mkdir(paths.docs, { recursive: true }),
    fs.mkdir(paths.store, { recursive: true }),
  ]);
};

process.on('unhandledRejection', (reason) => {
  void reportProcessLevelCrash(reason, 'process');
});

process.on('uncaughtException', (error) => {
  void reportProcessLevelCrash(error, 'process');
});

const main = async () => {
  await ensureDataDirs();

  const agent = await createMastermindAgent();
  createApiServer(agent);
};

main().catch(async (error) => {
  console.error('[mastermind] fatal', error);
  await reportProcessLevelCrash(error, 'startup');
  process.exit(1);
});
