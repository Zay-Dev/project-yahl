import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { fetchVerifyCheckpoint, postVerifyCheckpoint } from './session-api';

const withMockFetch = (
  handler: (url: string, init?: RequestInit) => Response | Promise<Response>,
  run: () => Promise<void>,
) => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

    return handler(url, init);
  }) as typeof fetch;

  return run().finally(() => {
    globalThis.fetch = originalFetch;
  });
};

describe('verify session-api', () => {
  it('postVerifyCheckpoint accepts flat server JSON', async () => {
    process.env.SESSION_API_BASE_URL = 'http://session.test';

    await withMockFetch(
      (url, init) => {
        if (url.includes('/verify-checkpoints') && init?.method === 'POST') {
          return Response.json({ verifyId: 'verify-flat' }, { status: 201 });
        }

        throw new Error(`unexpected fetch: ${url}`);
      },
      async () => {
        const result = await postVerifyCheckpoint('sess-1', { feedback: 'fail', score: 0 });

        assert.equal(result.verifyId, 'verify-flat');
      },
    );
  });

  it('fetchVerifyCheckpoint accepts flat server JSON', async () => {
    process.env.SESSION_API_BASE_URL = 'http://session.test';

    await withMockFetch(
      (url) => {
        if (url.includes('/verify-checkpoints/verify-flat')) {
          return Response.json({
            feedback: 'retry',
            requestId: 'req-1',
            score: 0.5,
            stage: { logic: 'x' },
            stageIndex: 10,
            status: 'resumed',
            storageSnapshot: { context: {} },
            verifyId: 'verify-flat',
          });
        }

        throw new Error(`unexpected fetch: ${url}`);
      },
      async () => {
        const checkpoint = await fetchVerifyCheckpoint('sess-1', 'verify-flat');

        assert.equal(checkpoint.verifyId, 'verify-flat');
        assert.equal(checkpoint.stageIndex, 10);
      },
    );
  });
});
