import assert from 'node:assert/strict';
import path from 'node:path';
import { describe, it } from 'node:test';

import { resolveNixeryOutputHint, resolveNixeryOutputRetry, resolveNixeryOutputSpec, resolveNixeryInlineToolResult } from './output-contract';

import type { TNixeryDef } from './types';

const baseDef = (overrides: Partial<TNixeryDef> = {}): TNixeryDef => ({
  id: 'test-def',
  packages: ['nodejs'],
  ...overrides,
});

describe('resolveNixeryOutputSpec', () => {
  it('defaults to output.md, validation.mjs, and retry 3', () => {
    assert.deepEqual(resolveNixeryOutputSpec(baseDef()), {
      default: 'output.md',
      inlineTool: false,
      retry: 3,
      validate: 'validation.mjs',
    });
  });

  it('honors explicit output.retry including 0', () => {
    assert.equal(resolveNixeryOutputSpec(baseDef({ output: { retry: 0 } })).retry, 0);
    assert.equal(resolveNixeryOutputSpec(baseDef({ output: { retry: 5 } })).retry, 5);
  });
});

describe('resolveNixeryOutputRetry', () => {
  it('defaults to 3 when omitted', () => {
    assert.equal(resolveNixeryOutputRetry(baseDef()), 3);
  });

  it('honors explicit 0 and 5', () => {
    assert.equal(resolveNixeryOutputRetry(baseDef({ output: { retry: 0 } })), 0);
    assert.equal(resolveNixeryOutputRetry(baseDef({ output: { retry: 5 } })), 5);
  });
});

describe('resolveNixeryOutputHint', () => {
  it('prefers args.output', () => {
    const def = baseDef({ output: { default: 'output.md' } });

    assert.equal(resolveNixeryOutputHint(def, { output: 'identity.md' }), 'identity.md');
  });
});

describe('resolveNixeryInlineToolResult', () => {
  it('returns ok for gate success', () => {
    assert.deepEqual(resolveNixeryInlineToolResult({ ok: true, paths: ['a'] }), {
      data: { ok: true, paths: ['a'] },
      ok: true,
    });
  });

  it('returns error for gate failure', () => {
    assert.deepEqual(resolveNixeryInlineToolResult({ error: 'failed', ok: false }), {
      data: { error: 'failed', ok: false },
      error: 'failed',
      ok: false,
    });
  });
});
