import type { TMastermindAgent } from './agent.js';

import { isSdkRetryableError } from './verify-infra.js';

const RETRY_DELAYS_MS = [1000, 3000];

const sleep = (ms: number) => new Promise<void>((resolve) => {
  setTimeout(resolve, ms);
});

export const promptWithActiveRunRetry = async (
  prompt: TMastermindAgent['prompt'],
  message: string,
  options?: { mode?: 'agent' | 'plan' },
): Promise<{ result?: string }> => {
  let lastError: unknown;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      return await prompt(message, options);
    } catch (error) {
      lastError = error;

      if (!isSdkRetryableError(error) || attempt >= RETRY_DELAYS_MS.length) {
        throw error;
      }

      await sleep(RETRY_DELAYS_MS[attempt]!);
    }
  }

  throw lastError;
};
