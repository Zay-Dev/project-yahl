import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

import {
  resolveNixeryInlineRetryMax,
  resolveNixerySoftFailToolResult,
} from './inline-retry';

describe('resolveNixeryInlineRetryMax', () => {
  const original = process.env.YAHL_NIXERY_INLINE_RETRY_MAX;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.YAHL_NIXERY_INLINE_RETRY_MAX;
    } else {
      process.env.YAHL_NIXERY_INLINE_RETRY_MAX = original;
    }
  });

  it('defaults to 3', () => {
    delete process.env.YAHL_NIXERY_INLINE_RETRY_MAX;

    assert.equal(resolveNixeryInlineRetryMax(), 3);
  });

  it('reads positive env', () => {
    process.env.YAHL_NIXERY_INLINE_RETRY_MAX = '5';

    assert.equal(resolveNixeryInlineRetryMax(), 5);
  });

  it('falls back on invalid env', () => {
    process.env.YAHL_NIXERY_INLINE_RETRY_MAX = '0';

    assert.equal(resolveNixeryInlineRetryMax(), 3);
  });
});

describe('resolveNixerySoftFailToolResult', () => {
  it('passes through success without hasError', () => {
    const out = resolveNixerySoftFailToolResult({
      maxRetries: 3,
      result: { ok: true, data: { path: 'a' } },
      softFailCount: 2,
    });

    assert.equal(out.hasError, false);
    assert.deepEqual(JSON.parse(out.result), { ok: true, data: { path: 'a' } });
  });

  it('soft-fails within budget with retryRemaining', () => {
    const out = resolveNixerySoftFailToolResult({
      maxRetries: 3,
      result: { ok: false, error: 'topic_hint is required' },
      softFailCount: 1,
    });

    assert.equal(out.hasError, false);
    assert.deepEqual(JSON.parse(out.result), {
      ok: false,
      error: 'topic_hint is required',
      retryRemaining: 2,
    });
  });

  it('allows soft fail at maxRetries', () => {
    const out = resolveNixerySoftFailToolResult({
      maxRetries: 3,
      result: { ok: false, error: 'cue is required' },
      softFailCount: 3,
    });

    assert.equal(out.hasError, false);
    assert.equal(JSON.parse(out.result).retryRemaining, 0);
  });

  it('abandons after budget exceeded without hasError', () => {
    const out = resolveNixerySoftFailToolResult({
      maxRetries: 3,
      result: { ok: false, error: 'topic_hint is required' },
      softFailCount: 4,
    });

    assert.equal(out.hasError, false);
    assert.deepEqual(JSON.parse(out.result), {
      ok: false,
      error: 'topic_hint is required',
      abandoned: true,
    });
  });

  it('soft-fails invalid arguments within budget', () => {
    const out = resolveNixerySoftFailToolResult({
      maxRetries: 3,
      result: { ok: false, error: 'nixery: invalid arguments' },
      softFailCount: 1,
    });

    assert.equal(out.hasError, false);
    assert.deepEqual(JSON.parse(out.result), {
      ok: false,
      error: 'nixery: invalid arguments',
      retryRemaining: 2,
    });
  });

  it('abandons invalid arguments after budget exceeded without hasError', () => {
    const out = resolveNixerySoftFailToolResult({
      maxRetries: 3,
      result: { ok: false, error: 'nixery: invalid arguments' },
      softFailCount: 4,
    });

    assert.equal(out.hasError, false);
    assert.deepEqual(JSON.parse(out.result), {
      ok: false,
      error: 'nixery: invalid arguments',
      abandoned: true,
    });
  });
});
