import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { requestStatusQuerySchema, skillRequestSchema } from './index.js';

describe('request-status contract', () => {
  it('requires sessionId and requestId', () => {
    const parsed = requestStatusQuerySchema.safeParse({
      requestId: 'req-1',
      sessionId: 'session-1',
    });

    assert.equal(parsed.success, true);
    assert.equal(parsed.success && parsed.data.requestId, 'req-1');
  });

  it('rejects missing requestId', () => {
    const parsed = requestStatusQuerySchema.safeParse({
      sessionId: 'session-1',
    });

    assert.equal(parsed.success, false);
  });
});

describe('skill request contract', () => {
  it('accepts optional requestId', () => {
    const parsed = skillRequestSchema.safeParse({
      args: {},
      caller: 'stage-agent',
      requestId: 'req-1',
      sessionId: 'session-1',
    });

    assert.equal(parsed.success, true);
    assert.equal(parsed.success && parsed.data.requestId, 'req-1');
  });
});
