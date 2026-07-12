import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildRequestStatusPayload,
  getLatestRequestActivity,
  getRequestActivity,
  markRequestActivitySucceeded,
  registerRequestActivity,
  resetRequestActivityForTests,
  setRequestActivityFailed,
} from './request-activity.js';
import { resetPromptQueueDepthForTests } from './agent-prompt-queue.js';

describe('request-activity', () => {
  it('tracks queued to running to succeeded lifecycle', () => {
    resetRequestActivityForTests();
    resetPromptQueueDepthForTests();

    registerRequestActivity({
      invocationId: 'inv-1',
      kind: 'verify',
      requestId: 'req-1',
      sessionId: 'session-1',
    });

    const queued = getRequestActivity('session-1', 'req-1', 'inv-1');

    assert.equal(queued?.status, 'queued');

    const payload = buildRequestStatusPayload({
      agent: 'ready',
      request: queued,
    });

    assert.equal(payload.ok, true);
    assert.equal(payload.queueDepth, 0);
  });

  it('isolates activity by invocationId', () => {
    resetRequestActivityForTests();

    registerRequestActivity({
      invocationId: 'inv-a',
      kind: 'skill',
      requestId: 'req-1',
      sessionId: 'session-1',
      skill: 'research',
    });

    setRequestActivityFailed({
      error: 'SDK stall',
      invocationId: 'inv-b',
      kind: 'skill',
      requestId: 'req-1',
      sessionId: 'session-1',
      skill: 'research',
    });

    const active = getRequestActivity('session-1', 'req-1', 'inv-a');
    const failed = getRequestActivity('session-1', 'req-1', 'inv-b');

    assert.equal(active?.status, 'queued');
    assert.equal(failed?.status, 'failed');
  });

  it('returns ok=false when request failed', () => {
    resetRequestActivityForTests();

    setRequestActivityFailed({
      error: 'SDK stall',
      kind: 'skill',
      requestId: 'req-2',
      sessionId: 'session-2',
      skill: 'research',
      unavailable: true,
    });

    const record = getRequestActivity('session-2', 'req-2');
    const payload = buildRequestStatusPayload({
      agent: 'ready',
      request: record,
    });

    assert.equal(record?.status, 'failed');
    assert.equal(payload.ok, false);
    assert.equal(payload.unavailable, true);
    assert.equal(payload.error, 'SDK stall');
  });

  it('getLatestRequestActivity returns most recent record without invocationId', () => {
    resetRequestActivityForTests();

    registerRequestActivity({
      invocationId: 'inv-old',
      kind: 'skill',
      requestId: 'req-1',
      sessionId: 'session-1',
      skill: 'research',
    });

    markRequestActivitySucceeded('session-1', 'req-1', 'inv-old', 'older result');

    registerRequestActivity({
      invocationId: 'inv-new',
      kind: 'skill',
      requestId: 'req-1',
      sessionId: 'session-1',
      skill: 'research',
    });

    const latest = getLatestRequestActivity('session-1', 'req-1');

    assert.equal(latest?.invocationId, 'inv-new');
    assert.equal(latest?.status, 'queued');
  });

  it('stores resultData on succeeded activity', () => {
    resetRequestActivityForTests();

    registerRequestActivity({
      invocationId: 'inv-1',
      kind: 'skill',
      requestId: 'req-1',
      sessionId: 'session-1',
      skill: 'research',
    });

    markRequestActivitySucceeded('session-1', 'req-1', 'inv-1', '# study notes');

    const record = getRequestActivity('session-1', 'req-1', 'inv-1');

    assert.equal(record?.status, 'succeeded');
    assert.equal(record?.resultData, '# study notes');
  });
});
