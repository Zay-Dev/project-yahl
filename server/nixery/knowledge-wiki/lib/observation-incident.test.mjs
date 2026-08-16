import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { resolveObservationIncidentId } from './observation-incident.mjs';

describe('resolveObservationIncidentId', () => {
  it('returns the same id for reordered evidence keys', () => {
    const input = {
      requestId: 'request-1',
      sessionId: 'session-1',
      tool: 'browser',
    };
    const first = resolveObservationIncidentId(input, {
      evidence: { error: 'parse failed', ok: false, tool: 'browser' },
    });
    const second = resolveObservationIncidentId(input, {
      evidence: { tool: 'browser', ok: false, error: 'parse failed' },
    });

    assert.equal(first, second);
    assert.match(first, /^error-[a-f0-9]{12}$/);
  });

  it('separates different requests and tools', () => {
    const observation = {
      evidence: { error: 'failed', ok: false },
    };
    const browser = resolveObservationIncidentId({
      requestId: 'request-1',
      sessionId: 'session-1',
      tool: 'browser',
    }, observation);
    const platform = resolveObservationIncidentId({
      requestId: 'request-1',
      sessionId: 'session-1',
      tool: 'platform',
    }, observation);
    const nextRequest = resolveObservationIncidentId({
      requestId: 'request-2',
      sessionId: 'session-1',
      tool: 'browser',
    }, observation);

    assert.notEqual(browser, platform);
    assert.notEqual(browser, nextRequest);
  });
});
