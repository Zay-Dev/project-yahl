import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

import { buildLlmHeaders } from './run-agent.mjs';

describe('buildLlmHeaders', () => {
  const keys = [
    'LLM_PROXY_TOKEN',
    'OPENAI_PROVIDER_DOMAIN',
    'YAHL_SESSION_ID',
    'YAHL_REQUEST_ID',
    'NIXERY_DEF_ID',
  ];

  const originals = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

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

  it('includes session, request, domain, token, and nixery tag', () => {
    process.env.LLM_PROXY_TOKEN = 'test-token';
    process.env.OPENAI_PROVIDER_DOMAIN = 'api.openai.com';
    process.env.YAHL_SESSION_ID = 'sess-1';
    process.env.YAHL_REQUEST_ID = 'req-1';
    process.env.NIXERY_DEF_ID = 'stage-verify';

    const headers = buildLlmHeaders({});

    assert.equal(headers['Content-Type'], 'application/json');
    assert.equal(headers['X-Llm-Proxy-Token'], 'test-token');
    assert.equal(headers['x-domain'], 'api.openai.com');
    assert.equal(headers['x-session-id'], 'sess-1');
    assert.equal(headers['x-request-id'], 'req-1');
    assert.equal(headers['x-tags'], 'nixery:stage-verify');
  });
});
