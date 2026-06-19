import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  isSetContextArgs,
  parseToolArgumentsDetailed,
  summarizeRawArguments,
} from './tool-call-parse';

describe('parseToolArgumentsDetailed', () => {
  it('returns parseError and raw string for truncated JSON', () => {
    const raw = '{"scope":"stage","key":"intel","value":[{"title":"x"';

    const result = parseToolArgumentsDetailed(raw);

    assert.equal(result.parsed, null);
    assert.equal(result.raw, raw);
    assert.ok(result.parseError);
  });

  it('parses canonical set_context args', () => {
    const raw = JSON.stringify({
      key: 'intel',
      scope: 'stage',
      value: [{ title: 'x' }],
    });

    const result = parseToolArgumentsDetailed(raw);

    assert.ok(isSetContextArgs(result.parsed));
    assert.equal(result.parseError, undefined);
  });
});

describe('summarizeRawArguments', () => {
  it('truncates long raw previews', () => {
    const raw = 'x'.repeat(500);

    assert.equal(summarizeRawArguments(raw, 100)?.length, 101);
  });
});
