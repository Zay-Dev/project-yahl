import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

import { resolveDefEnv } from './resolve-def-env';

describe('resolveDefEnv', () => {
  const keys = ['FOO', 'LLM_CALL_RETRY_MAX'] as const;

  const originals = Object.fromEntries(
    keys.map((key) => [key, process.env[key]]),
  );

  afterEach(() => {
    for (const key of keys) {
      const original = originals[key];

      if (original === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = original;
      }
    }
  });

  it('keeps non-empty literals from the def', () => {
    process.env.FOO = 'from-host';

    assert.deepEqual(
      resolveDefEnv({ FOO: 'from-def' }),
      { FOO: 'from-def' },
    );
  });

  it('inherits empty keys from same-named process.env', () => {
    process.env.LLM_CALL_RETRY_MAX = '5';

    assert.deepEqual(
      resolveDefEnv({ LLM_CALL_RETRY_MAX: '' }),
      { LLM_CALL_RETRY_MAX: '5' },
    );
  });

  it('skips empty inherit when process.env key is missing', () => {
    delete process.env.FOO;

    assert.deepEqual(resolveDefEnv({ FOO: '' }), {});
  });
});
