import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { fetchUserPauseCheckpoint } from './session-api';

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

describe('user-pause session-api', () => {
  it('fetchUserPauseCheckpoint accepts flat server JSON when status is resumed', async () => {
    process.env.SESSION_API_BASE_URL = 'http://session.test';

    await withMockFetch(
      (url) => {
        if (url.includes('/user-pause-checkpoints/pause-resumed')) {
          return Response.json({
            pauseId: 'pause-resumed',
            requestId: 'req-1',
            stage: { logic: 'x' },
            stageIndex: 2,
            status: 'resumed',
            storageSnapshot: { context: {} },
          });
        }

        throw new Error(`unexpected fetch: ${url}`);
      },
      async () => {
        const checkpoint = await fetchUserPauseCheckpoint('sess-1', 'pause-resumed');

        assert.equal(checkpoint.pauseId, 'pause-resumed');
        assert.equal(checkpoint.status, 'resumed');
        assert.equal(checkpoint.stageIndex, 2);
      },
    );
  });

  it('fetchUserPauseCheckpoint accepts wrapped server JSON', async () => {
    process.env.SESSION_API_BASE_URL = 'http://session.test';

    await withMockFetch(
      (url) => {
        if (url.includes('/user-pause-checkpoints/pause-wrapped')) {
          return Response.json({
            data: {
              pauseId: 'pause-wrapped',
              requestId: 'req-2',
              stage: { logic: 'y' },
              status: 'resumed',
              storageSnapshot: { context: {} },
            },
          });
        }

        throw new Error(`unexpected fetch: ${url}`);
      },
      async () => {
        const checkpoint = await fetchUserPauseCheckpoint('sess-1', 'pause-wrapped');

        assert.equal(checkpoint.pauseId, 'pause-wrapped');
        assert.equal(checkpoint.status, 'resumed');
      },
    );
  });
});
