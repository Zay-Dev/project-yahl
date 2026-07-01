import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';

import { probeMastermindHealth } from './index.js';

const originalFetch = globalThis.fetch;

describe('server health', () => {
  after(() => {
    globalThis.fetch = originalFetch;
  });

  it('probeMastermindHealth treats non-ok body as failure', async () => {
    globalThis.fetch = async () => new Response(
      JSON.stringify({ agent: 'auth_failed', ok: false }),
      { status: 503 },
    );

    const result = await probeMastermindHealth();

    assert.equal(result.ok, false);
    assert.equal(result.agent, 'auth_failed');
  });

  it('probeMastermindHealth succeeds when mastermind is ready', async () => {
    globalThis.fetch = async () => new Response(
      JSON.stringify({ agent: 'ready', ok: true }),
      { status: 200 },
    );

    const result = await probeMastermindHealth();

    assert.equal(result.ok, true);
    assert.equal(result.agent, 'ready');
  });
});
