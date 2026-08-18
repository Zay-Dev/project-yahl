import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  isRetryableLlmCallError,
  isRetryableLlmTransportError,
  LlmHttpError,
  LLM_TRANSPORT_RETRY_SLEEP_MS,
  resolveRetrySleepMs,
  withLlmCallRetry,
} from './retry.js';

describe('isRetryableLlmTransportError', () => {
  it('detects undici socket failures', () => {
    assert.equal(
      isRetryableLlmTransportError(new Error('fetch failed | UND_ERR_SOCKET other side closed')),
      true,
    );
    assert.equal(isRetryableLlmTransportError(new Error('ECONNRESET')), true);
  });

  it('does not treat generic errors as transport retryable', () => {
    assert.equal(isRetryableLlmTransportError(new Error('invalid request')), false);
  });

  it('retries request and headers timeouts', () => {
    assert.equal(isRetryableLlmTransportError(new Error('Request timed out.')), true);
    assert.equal(
      isRetryableLlmTransportError(Object.assign(new Error('Headers Timeout Error'), {
        code: 'UND_ERR_HEADERS_TIMEOUT',
        name: 'TimeoutError',
      })),
      true,
    );
  });
});

describe('isRetryableLlmCallError', () => {
  it('retries HTTP and transport failures', () => {
    assert.equal(isRetryableLlmCallError(new LlmHttpError('upstream 503', 503, '')), true);
    assert.equal(
      isRetryableLlmCallError(new Error('fetch failed | UND_ERR_SOCKET other side closed')),
      true,
    );
  });
});

describe('withLlmCallRetry', () => {
  it('retries transport errors with shorter sleep', async () => {
    let calls = 0;
    const sleeps: number[] = [];

    const result = await withLlmCallRetry(
      async () => {
        calls += 1;
        if (calls < 2) {
          throw new Error('fetch failed | UND_ERR_SOCKET other side closed');
        }
        return 'ok';
      },
      {
        maxAttempts: 3,
        sleepMs: 60_000,
        sleep: async (ms) => {
          sleeps.push(ms);
        },
      },
    );

    assert.equal(result, 'ok');
    assert.equal(calls, 2);
    assert.deepEqual(sleeps, [LLM_TRANSPORT_RETRY_SLEEP_MS]);
    assert.equal(
      resolveRetrySleepMs(new Error('UND_ERR_SOCKET'), 60_000),
      LLM_TRANSPORT_RETRY_SLEEP_MS,
    );
  });
});
