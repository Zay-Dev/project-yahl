import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveNixeryPolicy } from './resolve-policy';
import { validateNixeryArgv } from './validate-argv';
import { validateNixeryDef } from './validate-def';

test('validateNixeryDef accepts get-knowledge shape', () => {
  const def = validateNixeryDef({
    id: 'get-knowledge',
    packages: ['nodejs', 'curl', 'jq'],
    env: {
      OPENAI_BASE_URL: '',
      OPENAI_MODEL: 'gpt-4o',
      OPENAI_API_KEY: 'placeholder',
    },
    input: {
      purpose: { type: 'string', required: true },
    },
    mount: {
      '/workspace': { host: 'session', mode: 'rw' },
    },
    run: {
      entry: ['node', '/opt/nixery/def/run.mjs'],
    },
  });

  assert.equal(def.id, 'get-knowledge');
});

test('validateNixeryDef coerces YAML boolean policy modes', () => {
  const def = validateNixeryDef({
    id: 'get-knowledge',
    packages: ['bash'],
    nixery: {
      default: true,
      policies: [{ tools: ['bash'], mode: true }],
    },
  });

  assert.equal(def.nixery?.default, 'true');
  assert.equal(def.nixery?.policies?.[0]?.mode, 'true');
});

test('validateNixeryDef accepts list-knowledge-pages shape', () => {
  const def = validateNixeryDef({
    id: 'list-knowledge-pages',
    packages: ['shell', 'gnugrep', 'nodejs'],
    input: {
      topic: { type: 'string', required: true },
      output: { type: 'string', required: false },
    },
    mount: {
      '/data/knowledge_export': { host: 'data/knowledge_export', mode: 'ro' },
      '/workspace': { host: 'session', mode: 'rw' },
    },
    run: {
      entry: ['node', '/opt/nixery/def/run.mjs'],
    },
  });

  assert.equal(def.id, 'list-knowledge-pages');
});

test('validateNixeryDef accepts search-knowledge shape', () => {
  const def = validateNixeryDef({
    id: 'search-knowledge',
    packages: ['shell', 'gnugrep', 'nodejs'],
    input: {
      query: { type: 'string', required: true },
      topic: { type: 'string', required: false },
    },
    mount: {
      '/data/knowledge_export': { host: 'data/knowledge_export', mode: 'ro' },
      '/workspace': { host: 'session', mode: 'rw' },
    },
    run: {
      entry: ['node', '/opt/nixery/def/run.mjs'],
    },
  });

  assert.equal(def.id, 'search-knowledge');
});

test('validateNixeryArgv rejects docker flags', () => {
  assert.match(
    validateNixeryArgv(['git', 'status', '--mount', '/:/data']),
    /--mount/,
  );
});

test('resolveNixeryPolicy matches argvPrefix', () => {
  const mode = resolveNixeryPolicy({
    tools: ['git'],
    argv: ['git', 'push', 'origin'],
    def: {
      default: 'deny',
      tools: ['git'],
      policies: [
        { tools: ['git'], argvPrefix: ['push'], mode: 'propose' },
        { tools: ['git'], mode: 'true' },
      ],
    },
  });

  assert.equal(mode, 'propose');
});
