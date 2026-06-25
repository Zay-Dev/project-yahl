import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  exitIfMissingApiKey,
  isVerifyApiKeyConfigured,
  resolveWorkerReady,
} from './-health/server.js';

describe('worker startup guards', () => {
  it('requires CURSOR_API_KEY for verify', () => {
    assert.equal(isVerifyApiKeyConfigured(''), false);
    assert.equal(isVerifyApiKeyConfigured('key'), true);
  });

  it('resolveWorkerReady requires api key, agent cli, and fresh poll', () => {
    assert.equal(resolveWorkerReady({ agentCliReady: true, apiKey: '', pollFresh: true }), false);
    assert.equal(resolveWorkerReady({ agentCliReady: false, apiKey: 'key', pollFresh: true }), false);
    assert.equal(resolveWorkerReady({ agentCliReady: true, apiKey: 'key', pollFresh: false }), false);
    assert.equal(resolveWorkerReady({ agentCliReady: true, apiKey: 'key', pollFresh: true }), true);
  });

  it('exitIfMissingApiKey terminates when key missing', () => {
    let exited = false;

    exitIfMissingApiKey('', () => {
      exited = true;
      return undefined as never;
    });

    assert.equal(exited, true);
  });
});
