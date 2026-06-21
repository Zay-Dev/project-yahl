import fs from 'fs/promises';

import { reportProcessLevelCrash } from '../-crash-reports/index.js';
import { config, paths } from '../config.js';

const AUTH_PROBE_TIMEOUT_MS = 30_000;

export type TMastermindAgentStatus = 'auth_failed' | 'ready' | 'unconfigured';

export type TMastermindAgent = {
  prompt: (message: string, options?: { mode?: 'agent' | 'plan' }) => Promise<{ result?: string }>;
  status: TMastermindAgentStatus;
};

const probeAuth = async (
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

export const createMastermindAgent = async (): Promise<TMastermindAgent> => {
  if (!config.apiKey) {
    console.warn('[mastermind] CURSOR_API_KEY missing — skills unavailable');

    return {
      prompt: async () => {
        throw new Error('mastermind unavailable: CURSOR_API_KEY missing');
      },
      status: 'unconfigured',
    };
  }

  const { Agent, Cursor, JsonlLocalAgentStore } = await import('@cursor/sdk');

  await fs.mkdir(paths.store, { recursive: true });

  const store = new JsonlLocalAgentStore(paths.store);
  Cursor.configure({ local: { store } });

  let agent;

  try {
    agent = await Agent.create({
      apiKey: config.apiKey,
      local: {
        autoReview: true,
        cwd: config.workspaceRoot,
        settingSources: ['project'],
        store,
      },
      model: { id: 'auto' },
      name: 'yahl-mastermind',
    });
  } catch (error) {
    await reportProcessLevelCrash(error, 'startup');

    console.warn('[mastermind] agent create failed — skills unavailable');

    return {
      prompt: async () => {
        throw new Error('mastermind unavailable: agent create failed');
      },
      status: 'auth_failed',
    };
  }

  const authOk = await probeAuth(agent);

  if (!authOk) {
    console.warn('[mastermind] CURSOR_API_KEY auth failed — skills unavailable');

    return {
      prompt: async () => {
        throw new Error('mastermind unavailable: CURSOR_API_KEY auth failed');
      },
      status: 'auth_failed',
    };
  }

  return {
    prompt: async (message, options) => {
      const run = await agent.send(message, options?.mode ? { mode: options.mode } : undefined);
      const result = await run.wait();

      return { result: result.result };
    },
    status: 'ready',
  };
};
