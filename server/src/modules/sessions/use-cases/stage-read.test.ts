import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  collectToolResultById,
  parseToolArguments,
  parseToolSummaries,
  resolveToolCallRawArguments,
} from '../-utils/normalize-tool-call';

const INVALID_MONGO_ARGUMENTS =
  '{"scope": "types", "key": "TBriefSection", "value": {"type":"object","properties":{"title":{"type":"string"},"content":{"type":"string"},"items":{"type":"array","items":{"type":"object","properties":{"title":{"type":"string"},"summary":{"type":"string"},"sentiment":{"type":"string"},"date":{"type":"string"},"category":{"type":"string"},"source_url":{"type":"string"}}}}}}}}';

const VALID_SET_CONTEXT_ARGUMENTS =
  '{"scope":"context","key":"sections","value":[{"heading":"Tesla","body_md":"summary"}]}';

describe('parseToolArguments', () => {
  it('returns null for missing arguments', () => {
    assert.equal(parseToolArguments(undefined), null);
    assert.equal(parseToolArguments(null), null);
    assert.equal(parseToolArguments('   '), null);
  });

  it('returns parsed object for valid JSON string', () => {
    const parsed = parseToolArguments(VALID_SET_CONTEXT_ARGUMENTS) as Record<string, unknown>;

    assert.equal(parsed.scope, 'context');
    assert.equal(parsed.key, 'sections');
    assert.ok(Array.isArray(parsed.value));
  });

  it('returns raw string when JSON.parse fails (Mongo invalid payload)', () => {
    assert.throws(() => JSON.parse(INVALID_MONGO_ARGUMENTS));

    const result = parseToolArguments(INVALID_MONGO_ARGUMENTS);

    assert.equal(typeof result, 'string');
    assert.equal(result, INVALID_MONGO_ARGUMENTS);
  });

  it('passes through already-parsed objects', () => {
    const value = { key: 'title', scope: 'context', value: 'hello' };

    assert.deepEqual(parseToolArguments(value), value);
  });
});

describe('resolveToolCallRawArguments', () => {
  it('reads nested function.arguments', () => {
    assert.equal(
      resolveToolCallRawArguments({
        function: { arguments: VALID_SET_CONTEXT_ARGUMENTS, name: 'set_context' },
        id: 'call-1',
      }),
      VALID_SET_CONTEXT_ARGUMENTS,
    );
  });

  it('falls back to top-level arguments', () => {
    assert.equal(
      resolveToolCallRawArguments({
        arguments: VALID_SET_CONTEXT_ARGUMENTS,
        function: { name: 'set_context' },
        id: 'call-1',
      }),
      VALID_SET_CONTEXT_ARGUMENTS,
    );
  });
});

describe('parseToolSummaries', () => {
  it('maps canonical OpenAI tool call shape', () => {
    const [tool] = parseToolSummaries([
      {
        function: {
          arguments: VALID_SET_CONTEXT_ARGUMENTS,
          name: 'set_context',
        },
        id: 'call-1',
        type: 'function',
      },
    ]);

    assert.equal(tool.name, 'set_context');
    assert.equal(tool.id, 'call-1');
    assert.equal((tool.arguments as Record<string, unknown>).key, 'sections');
  });

  it('preserves invalid JSON as raw string for UI parse error display', () => {
    const [tool] = parseToolSummaries([
      {
        function: {
          arguments: INVALID_MONGO_ARGUMENTS,
          name: 'set_context',
        },
        id: 'call_00_Vjq2dBV7EyumPGe0zerI0720',
        type: 'function',
      },
    ]);

    assert.equal(tool.name, 'set_context');
    assert.equal(typeof tool.arguments, 'string');
    assert.equal(tool.arguments, INVALID_MONGO_ARGUMENTS);
  });

  it('handles top-level arguments sibling shape', () => {
    const [tool] = parseToolSummaries([
      {
        arguments: VALID_SET_CONTEXT_ARGUMENTS,
        function: { name: 'set_context' },
        id: 'call-2',
      },
    ]);

    assert.equal((tool.arguments as Record<string, unknown>).scope, 'context');
  });
});

describe('collectToolResultById', () => {
  it('maps result content by tool call id', () => {
    const byId = collectToolResultById([
      { results: [{ content: 'skill body', id: 'call-1' }] },
      { results: [{ content: 'ok', id: 'call-2' }] },
    ]);

    assert.equal(byId.get('call-1'), 'skill body');
    assert.equal(byId.get('call-2'), 'ok');
  });

  it('keeps real stdout when a later stub row arrives', () => {
    const byId = collectToolResultById([
      { results: [{ content: 'OK', id: 'call-1' }] },
      { results: [{ content: '# route-analysis\n', id: 'call-1' }] },
    ]);

    assert.equal(byId.get('call-1'), '# route-analysis\n');
  });

  it('does not replace real stdout with a later stub', () => {
    const byId = collectToolResultById([
      { results: [{ content: '# route-analysis\n', id: 'call-1' }] },
      { results: [{ content: 'OK', id: 'call-1' }] },
    ]);

    assert.equal(byId.get('call-1'), '# route-analysis\n');
  });
});
