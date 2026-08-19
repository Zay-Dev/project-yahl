import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  dedupePackages,
  isTransientDockerPullError,
  pullDockerImageWithRetry,
  resolveNixeryImage,
  resolveNixeryRegistry,
} from '@/orchestrator/-nixery/run-container';

describe('dedupePackages', () => {
  it('removes duplicates while preserving order', () => {
    assert.deepEqual(dedupePackages(['git', 'jq', 'git', 'curl']), ['git', 'jq', 'curl']);
  });

  it('returns empty array for empty input', () => {
    assert.deepEqual(dedupePackages([]), []);
  });
});

describe('resolveNixeryImage', () => {
  it('builds composed registry ref from packages', () => {
    assert.equal(
      resolveNixeryImage('nixery.dev', ['git', 'jq']),
      'nixery.dev/git/jq',
    );
  });

  it('dedupes packages before composing ref', () => {
    assert.equal(
      resolveNixeryImage('nixery.dev', ['git', 'jq', 'git']),
      'nixery.dev/git/jq',
    );
  });

  it('handles single package', () => {
    assert.equal(resolveNixeryImage('nixery.dev', ['git']), 'nixery.dev/git');
  });
});

describe('resolveNixeryRegistry', () => {
  it('defaults to nixery.dev', () => {
    const original = process.env.NIXERY_REGISTRY;

    delete process.env.NIXERY_REGISTRY;

    try {
      assert.equal(resolveNixeryRegistry(), 'nixery.dev');
    } finally {
      if (original === undefined) {
        delete process.env.NIXERY_REGISTRY;
      } else {
        process.env.NIXERY_REGISTRY = original;
      }
    }
  });
});

describe('isTransientDockerPullError', () => {
  it('detects EOF and failed-to-do-request registry blips', () => {
    assert.equal(
      isTransientDockerPullError(
        'failed to resolve reference "nixery.dev/nodejs:latest": failed to do request: Head "...": EOF',
      ),
      true,
    );
  });

  it('rejects non-transient auth or not-found errors', () => {
    assert.equal(isTransientDockerPullError('pull access denied'), false);
    assert.equal(isTransientDockerPullError('manifest unknown'), false);
  });
});

describe('pullDockerImageWithRetry', () => {
  it('retries transient failures then succeeds', async () => {
    let attempts = 0;
    const sleeps: number[] = [];

    await pullDockerImageWithRetry('nixery.dev/nodejs', {
      maxAttempts: 3,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
      pull: async () => {
        attempts += 1;

        if (attempts < 3) {
          throw new Error('failed to do request: EOF');
        }
      },
    });

    assert.equal(attempts, 3);
    assert.deepEqual(sleeps, [1000, 2000]);
  });

  it('does not retry non-transient errors', async () => {
    let attempts = 0;

    await assert.rejects(
      () => pullDockerImageWithRetry('nixery.dev/nodejs', {
        maxAttempts: 3,
        sleep: async () => undefined,
        pull: async () => {
          attempts += 1;
          throw new Error('pull access denied');
        },
      }),
      /pull access denied/,
    );

    assert.equal(attempts, 1);
  });

  it('exhausts attempts on persistent transient errors', async () => {
    let attempts = 0;

    await assert.rejects(
      () => pullDockerImageWithRetry('nixery.dev/nodejs', {
        maxAttempts: 3,
        sleep: async () => undefined,
        pull: async () => {
          attempts += 1;
          throw new Error('connection reset by peer');
        },
      }),
      /connection reset/,
    );

    assert.equal(attempts, 3);
  });
});
