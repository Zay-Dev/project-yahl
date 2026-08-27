import assert from 'node:assert/strict';
import test from 'node:test';

import { validateNixeryPluginMeta } from './validate-def';

test('validateNixeryPluginMeta accepts skills and prompts lists', () => {
  const meta = validateNixeryPluginMeta({
    name: 'Fixture',
    skills: ['SKILLS/nixery', 'SKILLS/resolve-errors-with-knowledge'],
    prompts: ['prompts/nixery.md'],
  });

  assert.deepEqual(meta.skills, ['SKILLS/nixery', 'SKILLS/resolve-errors-with-knowledge']);
  assert.deepEqual(meta.prompts, ['prompts/nixery.md']);
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
