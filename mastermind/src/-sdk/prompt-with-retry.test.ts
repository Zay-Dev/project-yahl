import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { promptWithActiveRunRetry } from './prompt-with-retry.js';

describe('promptWithActiveRunRetry', () => {
  it('retries active-run errors with backoff then succeeds', async () => {
    let attempts = 0;

    const prompt = async () => {
      attempts += 1;

      if (attempts < 3) {
        throw new Error('Agent agent-abc already has active run');
      }

      return { result: 'ok' };
    };

    const result = await promptWithActiveRunRetry(prompt, 'verify');

    assert.equal(result.result, 'ok');
    assert.equal(attempts, 3);
  });

  it('retries stall-abort errors with backoff then succeeds', async () => {
    let attempts = 0;

    const prompt = async () => {
      attempts += 1;

      if (attempts < 2) {
        throw new Error('[canceled] This operation was aborted');
      }

      return { result: 'ok' };
    };

    const result = await promptWithActiveRunRetry(prompt, 'extract-knowledge');

    assert.equal(result.result, 'ok');
    assert.equal(attempts, 2);
  });

  it('throws immediately for non-retryable errors', async () => {
    let attempts = 0;

    const prompt = async () => {
      attempts += 1;
      throw new Error('network down');
    };

    await assert.rejects(
      () => promptWithActiveRunRetry(prompt, 'verify'),
      /network down/,
    );

    assert.equal(attempts, 1);
  });
});
