import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  isSetContextArgs,
  parseToolArgumentsDetailed,
  parseToolSummaries,
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

describe('parseToolSummaries', () => {
  it('maps OpenAI tool call shape', () => {
    const tools = parseToolSummaries([
      {
        function: {
          arguments: '{"command":"ls"}',
          name: 'shell',
        },
        id: 'call_1',
      },
    ]);

    assert.equal(tools[0]?.id, 'call_1');
    assert.equal(tools[0]?.name, 'shell');
    assert.deepEqual(tools[0]?.arguments, { command: 'ls' });
  });
});

describe('summarizeRawArguments', () => {
  it('truncates long raw previews', () => {
    const raw = 'x'.repeat(500);

    assert.equal(summarizeRawArguments(raw, 100)?.length, 101);
  });
});
