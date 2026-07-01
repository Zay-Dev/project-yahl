import 'dotenv/config';

import fs from 'fs/promises';
import path from 'path';

import { initCrashReports, reportProcessLevelCrash } from './-crash-reports/index.js';
import { paths } from './config.js';
import { createApiServer } from './-api/server.js';
import { createMastermindAgent } from './-sdk/agent.js';
import { assertBootReady } from './-sdk/self-check.js';
import { isSdkAuthError, isSdkStallAbortError } from './-sdk/verify-infra.js';

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
  if (isSdkStallAbortError(reason)) {
    console.warn('[mastermind] SDK stall abort (suppressed process crash)', reason);
    return;
  }

  if (isSdkAuthError(reason)) {
    console.warn('[mastermind] SDK auth error (suppressed process crash)', reason);
    return;
  }

  void reportProcessLevelCrash(reason, 'process');
});

process.on('uncaughtException', (error) => {
  void reportProcessLevelCrash(error, 'process');
});

const main = async () => {
  await ensureDataDirs();

  const agent = await createMastermindAgent();

  await assertBootReady(agent);

  initCrashReports(agent.prompt);
  createApiServer(agent);
};

main().catch(async (error) => {
  console.error('[mastermind] fatal', error);
  await reportProcessLevelCrash(error, 'startup');
  process.exit(1);
});
