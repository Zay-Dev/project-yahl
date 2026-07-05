import fs from 'fs/promises';

import { reportProcessLevelCrash } from '../-crash-reports/index.js';
import { config, paths } from '../config.js';

import { createPromptQueue } from './agent-prompt-queue.js';
import { logRunStreamIfEnabled } from './log-run-stream.js';
import { probeSdkAuth } from './self-check.js';

export type TMastermindAgentStatus = 'auth_failed' | 'ready' | 'unconfigured';

export type TMastermindAgent = {
  prompt: (message: string, options?: { mode?: 'agent' | 'plan' }) => Promise<{ result?: string }>;
  status: TMastermindAgentStatus;
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

  const authOk = await probeSdkAuth(agent);

  if (!authOk) {
    console.warn('[mastermind] CURSOR_API_KEY auth failed — skills unavailable');

    return {
      prompt: async () => {
        throw new Error('mastermind unavailable: CURSOR_API_KEY auth failed');
      },
      status: 'auth_failed',
    };
  }

  const enqueuePrompt = createPromptQueue();

  return {
    prompt: (message, options) => enqueuePrompt(async () => {
      const run = await agent.send(message, options?.mode ? { mode: options.mode } : undefined);

      await logRunStreamIfEnabled(run);

      const result = await run.wait();

      return { result: result.result };
    }),
    status: 'ready',
  };
};
