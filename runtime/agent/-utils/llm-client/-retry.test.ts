import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

import {
  isRetryableLlmHttpError,
  resolveLlmCallRetryMax,
  withLlmCallRetry,
} from './-retry';

describe('resolveLlmCallRetryMax', () => {
  const original = process.env.LLM_CALL_RETRY_MAX;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.LLM_CALL_RETRY_MAX;
    } else {
      process.env.LLM_CALL_RETRY_MAX = original;
    }
  });

  it('defaults to 3', () => {
    delete process.env.LLM_CALL_RETRY_MAX;

    assert.equal(resolveLlmCallRetryMax(), 3);
  });

  it('reads positive env', () => {
    process.env.LLM_CALL_RETRY_MAX = '5';

    assert.equal(resolveLlmCallRetryMax(), 5);
  });

  it('falls back on invalid env', () => {
    process.env.LLM_CALL_RETRY_MAX = '0';

    assert.equal(resolveLlmCallRetryMax(), 3);
  });
});

describe('isRetryableLlmHttpError', () => {
  it('retries all 4xx and >=500', () => {
    assert.equal(isRetryableLlmHttpError({ status: 400 }), true);
    assert.equal(isRetryableLlmHttpError({ status: 401 }), true);
    assert.equal(isRetryableLlmHttpError({ status: 402 }), true);
    assert.equal(isRetryableLlmHttpError({ status: 403 }), true);
    assert.equal(isRetryableLlmHttpError({ status: 408 }), true);
    assert.equal(isRetryableLlmHttpError({ status: 429 }), true);
    assert.equal(isRetryableLlmHttpError({ status: 500 }), true);
    assert.equal(isRetryableLlmHttpError({ status: 503 }), true);
    assert.equal(isRetryableLlmHttpError({ statusCode: 429 }), true);
  });

  it('retries numeric string status and message-embedded 4xx/5xx', () => {
    assert.equal(isRetryableLlmHttpError({ status: '503' }), true);
    assert.equal(isRetryableLlmHttpError({ statusCode: '429' }), true);
    assert.equal(isRetryableLlmHttpError({ status: '400' }), true);
    assert.equal(
      isRetryableLlmHttpError(
        new Error('503 <503> ***.Algo: An error occurred in model serving'),
      ),
      true,
    );
    assert.equal(isRetryableLlmHttpError(new Error('<503> throttled')), true);
    assert.equal(isRetryableLlmHttpError(new Error('400 bad request')), true);
  });

  it('does not retry missing status', () => {
    assert.equal(isRetryableLlmHttpError(new Error('network')), false);
    assert.equal(isRetryableLlmHttpError(null), false);
  });
});

describe('withLlmCallRetry', () => {
  it('retries 429 then succeeds with ×1.1 sleep growth', async () => {
    let calls = 0;
    const sleeps: number[] = [];

    const result = await withLlmCallRetry(
      async () => {
        calls += 1;
        if (calls < 3) {
          const error = Object.assign(new Error('rate limited'), { status: 429 });
          throw error;
        }
        return 'ok';
      },
      {
        maxAttempts: 3,
        sleepMs: 10,
        sleep: async (ms) => {
          sleeps.push(ms);
        },
      },
    );

    assert.equal(result, 'ok');
    assert.equal(calls, 3);
    assert.deepEqual(sleeps, [10, 11]);
  });

  it('retries 503 and 408', async () => {
    let calls = 0;

    const result = await withLlmCallRetry(
      async () => {
        calls += 1;
        if (calls === 1) {
          throw Object.assign(new Error('server'), { status: 503 });
        }
        if (calls === 2) {
          throw Object.assign(new Error('timeout'), { status: 408 });
        }
        return 'ok';
      },
      {
        maxAttempts: 3,
        sleep: async () => {},
      },
    );

    assert.equal(result, 'ok');
    assert.equal(calls, 3);
  });

  it('retries message-only 503 then succeeds', async () => {
    let calls = 0;

    const result = await withLlmCallRetry(
      async () => {
        calls += 1;
        if (calls === 1) {
          throw new Error('503 <503> ***.Algo: throttled due to system capacity limits');
        }
        return 'ok';
      },
      {
        maxAttempts: 3,
        sleepMs: 10,
        sleep: async () => {},
      },
    );

    assert.equal(result, 'ok');
    assert.equal(calls, 2);
  });

  it('retries 402 then succeeds', async () => {
    let calls = 0;

    const result = await withLlmCallRetry(
      async () => {
        calls += 1;
        if (calls === 1) {
          throw Object.assign(new Error('Insufficient Balance'), { status: 402 });
        }
        return 'ok';
      },
      {
        maxAttempts: 3,
        sleepMs: 10,
        sleep: async () => {},
      },
    );

    assert.equal(result, 'ok');
    assert.equal(calls, 2);
  });

  it('throws missing-status errors immediately without retry', async () => {
    let calls = 0;

    await assert.rejects(
      () => withLlmCallRetry(
        async () => {
          calls += 1;
          throw new Error('network');
        },
        {
          maxAttempts: 3,
          sleep: async () => {
            assert.fail('should not sleep for non-retryable error');
          },
        },
      ),
      (error: unknown) => {
        assert.equal(error instanceof Error && error.message, 'network');
        return true;
      },
    );

    assert.equal(calls, 1);
  });

  it('exhausts attempt budget on repeated 429', async () => {
    let calls = 0;

    await assert.rejects(
      () => withLlmCallRetry(
        async () => {
          calls += 1;
          throw Object.assign(new Error('rate limited'), { status: 429 });
        },
        {
          maxAttempts: 3,
          sleep: async () => {},
        },
      ),
      (error: unknown) => {
        assert.equal((error as { status: number }).status, 429);
        return true;
      },
    );

    assert.equal(calls, 3);
  });
});
