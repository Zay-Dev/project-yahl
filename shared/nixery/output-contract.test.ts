import assert from 'node:assert/strict';
import path from 'node:path';
import { describe, it } from 'node:test';

import { resolveNixeryOutputHint, resolveNixeryOutputSpec, resolveNixeryInlineToolResult } from './output-contract';

import type { TNixeryDef } from './types';

const baseDef = (overrides: Partial<TNixeryDef> = {}): TNixeryDef => ({
  id: 'test-def',
  packages: ['nodejs'],
  ...overrides,
});

describe('resolveNixeryOutputSpec', () => {
  it('defaults to output.md and validation.mjs', () => {
    assert.deepEqual(resolveNixeryOutputSpec(baseDef()), {
      default: 'output.md',
      inlineTool: false,
      validate: 'validation.mjs',
    });
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
