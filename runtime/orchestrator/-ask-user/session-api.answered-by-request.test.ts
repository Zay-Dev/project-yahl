import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { fetchAnsweredAskUserQuestionIdByRequestId } from './session-api';

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

describe('fetchAnsweredAskUserQuestionIdByRequestId', () => {
  it('returns questionId for answered question on requestId', async () => {
    process.env.SESSION_API_BASE_URL = 'http://session.test';

    await withMockFetch(
      (url) => {
        assert.match(url, /ask-user\/questions\?status=answered/);

        return Response.json([
          { questionId: 'q-other', requestId: 'req-other', status: 'answered' },
          { questionId: 'q-match', requestId: 'req-1', status: 'answered' },
        ]);
      },
      async () => {
        const questionId = await fetchAnsweredAskUserQuestionIdByRequestId('sess-1', 'req-1');

        assert.equal(questionId, 'q-match');
      },
    );
  });

  it('returns undefined when no answered question matches requestId', async () => {
    process.env.SESSION_API_BASE_URL = 'http://session.test';

    await withMockFetch(
      () => Response.json({ data: [{ questionId: 'q-1', requestId: 'req-x', status: 'answered' }] }),
      async () => {
        const questionId = await fetchAnsweredAskUserQuestionIdByRequestId('sess-1', 'req-missing');

        assert.equal(questionId, undefined);
      },
    );
  });
});
