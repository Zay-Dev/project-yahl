import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createPromptQueue } from './agent-prompt-queue.js';

describe('createPromptQueue', () => {
  it('runs concurrent prompts one at a time', async () => {
    const enqueue = createPromptQueue();
    let inFlight = 0;
    let maxInFlight = 0;
    const startTimes: number[] = [];

    const run = () => enqueue(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      startTimes.push(Date.now());

      await new Promise((resolve) => {
        setTimeout(resolve, 40);
      });

      inFlight -= 1;

      return 'ok';
    });

    await Promise.all([run(), run()]);

    assert.equal(maxInFlight, 1);
    assert.equal(startTimes.length, 2);
    assert.ok(startTimes[1]! - startTimes[0]! >= 35);
  });

  it('continues the queue after a failed prompt', async () => {
    const enqueue = createPromptQueue();
    const outcomes: Array<'fail' | 'ok'> = [];

    await assert.rejects(
      enqueue(async () => {
        outcomes.push('fail');
        throw new Error('prompt failed');
      }),
      /prompt failed/,
    );

    await enqueue(async () => {
      outcomes.push('ok');
    });

    assert.deepEqual(outcomes, ['fail', 'ok']);
  });
});
