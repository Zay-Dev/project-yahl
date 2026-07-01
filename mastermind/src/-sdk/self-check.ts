import fs from 'fs/promises';

import { reportProcessLevelCrash } from '../-crash-reports/index.js';
import { paths } from '../config.js';

import type { TMastermindAgent, TMastermindAgentStatus } from './agent.js';

export const AUTH_PROBE_TIMEOUT_MS = 30_000;

export type TSelfCheckResult = {
  agent: TMastermindAgentStatus;
  checks: {
    dataDirs: 'failed' | 'ok';
    sdkAuth?: 'failed' | 'ok' | 'skipped';
  };
  error?: string;
  ok: boolean;
};

const dataDirPaths = [
  paths.crashReports,
  paths.docs,
  paths.knowledges,
  paths.rules,
  paths.store,
];

export const checkDataDirsWritable = async (): Promise<'failed' | 'ok'> => {
  try {
    await Promise.all(
      dataDirPaths.map(async (dirPath) => {
        await fs.access(dirPath, fs.constants.W_OK);
      }),
    );

    return 'ok';
  } catch {
    return 'failed';
  }
};

export const probeSdkAuth = async (
  agent: { send: (message: string) => Promise<{ wait: () => Promise<unknown> }> },
): Promise<boolean> => {
  const probe = async () => {
    const run = await agent.send('Reply with exactly: ok');
    await run.wait();
  };

  try {
    await Promise.race([
      probe(),
      new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error(`auth probe timed out after ${AUTH_PROBE_TIMEOUT_MS}ms`)),
          AUTH_PROBE_TIMEOUT_MS,
        );
      }),
    ]);

    return true;
  } catch (error) {
    await reportProcessLevelCrash(error, 'startup');

    return false;
  }
};

export const runSelfCheck = async (
  agent: TMastermindAgent,
  options?: { ping?: boolean },
): Promise<TSelfCheckResult> => {
  const dataDirs = await checkDataDirsWritable();

  if (dataDirs === 'failed') {
    return {
      agent: agent.status,
      checks: { dataDirs },
      error: 'data directories not writable',
      ok: false,
    };
  }

  if (agent.status !== 'ready') {
    return {
      agent: agent.status,
      checks: { dataDirs, sdkAuth: 'skipped' },
      error: `agent not ready: ${agent.status}`,
      ok: false,
    };
  }

  if (!options?.ping) {
    return {
      agent: agent.status,
      checks: { dataDirs, sdkAuth: 'skipped' },
      ok: true,
    };
  }

  try {
    await agent.prompt('Reply with exactly: ok');

    return {
      agent: agent.status,
      checks: { dataDirs, sdkAuth: 'ok' },
      ok: true,
    };
  } catch (error) {
    return {
      agent: agent.status,
      checks: { dataDirs, sdkAuth: 'failed' },
      error: error instanceof Error ? error.message : 'sdk ping failed',
      ok: false,
    };
  }
};

export const assertBootReady = async (agent: TMastermindAgent): Promise<void> => {
  const result = await runSelfCheck(agent);

  if (result.ok) {
    return;
  }

  console.error('[mastermind] startup self-check failed', JSON.stringify(result));
  process.exit(1);
};
