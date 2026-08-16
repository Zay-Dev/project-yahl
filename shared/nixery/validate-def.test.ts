import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';

import { listNixeryDefIds, resolveNixeryAbilityLocation } from './list-defs';
import { loadNixeryDefFromFile } from './load-def';
import { resolveNixeryPolicy } from './resolve-policy';
import { validateNixeryArgv } from './validate-argv';
import { validateNixeryDef, validateNixeryPluginMeta } from './validate-def';

test('validateNixeryDef accepts read-def shape', () => {
  const def = validateNixeryDef({
    id: 'read-def-fixture',
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
      runtime: 'node',
      entry: 'run.mjs',
    },
  });

  assert.equal(def.id, 'read-def-fixture');
  assert.equal(def.run?.runtime, 'node');
});

test('validateNixeryDef coerces YAML boolean policy modes', () => {
  const def = validateNixeryDef({
    id: 'policy-fixture',
    packages: ['bash'],
    nixery: {
      default: true,
      policies: [{ tools: ['bash'], mode: true }],
    },
  });

  assert.equal(def.nixery?.default, 'true');
  assert.equal(def.nixery?.policies?.[0]?.mode, 'true');
});

test('validateNixeryDef accepts write-def shape with plugin mount', () => {
  const def = validateNixeryDef({
    id: 'write-def-fixture',
    packages: ['nodejs'],
    input: {
      topic: { type: 'string', required: false },
      key: { type: 'string', required: false },
      value: { type: 'string', required: false },
    },
    mount: {
      '/opt/nixery/plugin': { host: 'plugin', mode: 'ro' },
      '/workspace': { host: 'session', mode: 'rw' },
    },
    run: {
      runtime: 'node',
      entry: 'run.mjs',
    },
  });

  assert.equal(def.id, 'write-def-fixture');
});

test('validateNixeryDef accepts output block', () => {
  const def = validateNixeryDef({
    id: 'inline-tool-fixture',
    packages: ['nodejs'],
    output: {
      default: 'result.json',
      inlineTool: true,
      retry: 2,
      validate: 'validation.mjs',
    },
    run: {
      runtime: 'node',
      entry: 'run.mjs',
    },
  });

  assert.equal(def.output?.default, 'result.json');
  assert.equal(def.output?.inlineTool, true);
  assert.equal(def.output?.retry, 2);
  assert.equal(def.output?.validate, 'validation.mjs');
});

test('validateNixeryDef rejects absolute run.entry', () => {
  assert.throws(() => validateNixeryDef({
    id: 'bad-entry',
    packages: ['nodejs'],
    run: {
      runtime: 'node',
      entry: '/opt/nixery/def/run.mjs',
    },
  }));
});

test('validateNixeryDef rejects negative output.retry', () => {
  assert.throws(() => validateNixeryDef({
    id: 'bad-retry',
    packages: ['nodejs'],
    output: {
      retry: -1,
    },
  }));
});

test('validateNixeryDef rejects non-integer output.retry', () => {
  assert.throws(() => validateNixeryDef({
    id: 'bad-retry-float',
    packages: ['nodejs'],
    output: {
      retry: 1.5,
    },
  }));
});

test('validateNixeryDef rejects invalid output.validate filename', () => {
  assert.throws(() => validateNixeryDef({
    id: 'bad-def',
    packages: ['nodejs'],
    output: {
      validate: 'validation.ts',
    },
  }));
});

test('validateNixeryDef rejects empty packages', () => {
  assert.throws(() => validateNixeryDef({
    id: 'no-packages',
    packages: [],
  }));
});

test('validateNixeryDef rejects dockerfile key', () => {
  assert.throws(
    () => validateNixeryDef({
      id: 'dockerfile-fixture',
      packages: ['shell', 'nodejs'],
      dockerfile: 'Dockerfile',
    }),
    /dockerfile is not supported/,
  );
});

test('validateNixeryDef parses all live index.yml files', async () => {
  const nixeryRoot = path.join(import.meta.dirname, '..', '..', 'server', 'nixery');
  const defIds = await listNixeryDefIds(nixeryRoot);

  assert.ok(defIds.length >= 1);

  for (const defId of defIds) {
    const location = await resolveNixeryAbilityLocation(nixeryRoot, defId);
    const def = await loadNixeryDefFromFile(location.indexPath);

    assert.equal(def.id, defId);
    assert.equal(def.output?.validate, 'validation.mjs');
    assert.ok(def.output?.default);
    assert.equal(def.run?.runtime, 'node');
    assert.equal(def.run?.entry, 'run.mjs');
  }
});

test('validateNixeryPluginMeta rejects parent-path artifacts', () => {
  assert.throws(() => validateNixeryPluginMeta({
    skills: ['../escape'],
  }));
});

test('validateNixeryPluginMeta rejects absolute artifact paths', () => {
  assert.throws(() => validateNixeryPluginMeta({
    prompts: ['/tmp/prompt.md'],
  }));
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
