import assert from 'node:assert/strict';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { describe, it } from 'node:test';

import { createPromptQueue } from '../-sdk/agent-prompt-queue.js';

describe('initCrashReports', () => {
  it('routes crash analysis through the injected queued prompt', async () => {
    const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mastermind-crash-'));

    process.env.MASTERMIND_DATA_ROOT = dataRoot;
    process.env.CURSOR_API_KEY = 'test-key';

    const { initCrashReports, writeAndAnalyzeCrash } = await import('./index.js');

    let inFlight = 0;
    let maxInFlight = 0;
    const promptCalls: string[] = [];
    const enqueue = createPromptQueue();

    initCrashReports((message, options) => enqueue(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      promptCalls.push(`${options?.mode ?? 'default'}:${message.slice(0, 24)}`);

      await new Promise((resolve) => {
        setTimeout(resolve, 30);
      });

      inFlight -= 1;

      return { result: 'analysis ok' };
    }));

    await Promise.all([
      writeAndAnalyzeCrash({
        caller: 'test',
        error: new Error('first failure'),
        skill: 'verify',
      }),
      writeAndAnalyzeCrash({
        caller: 'test',
        error: new Error('second failure'),
        skill: 'verify',
      }),
    ]);

    await new Promise((resolve) => {
      setTimeout(resolve, 120);
    });

    assert.equal(maxInFlight, 1);
    assert.equal(promptCalls.length, 2);
    assert.equal(promptCalls[0]?.startsWith('plan:'), true);

    delete process.env.MASTERMIND_DATA_ROOT;
    delete process.env.CURSOR_API_KEY;
  });
});
