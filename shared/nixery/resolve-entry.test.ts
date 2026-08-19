import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveNixeryDefEntryArgv, resolveNixeryEntryArgv } from './resolve-entry';

test('resolveNixeryEntryArgv runs from plugin ability path', () => {
  assert.deepEqual(
    resolveNixeryEntryArgv({
      abilityId: 'whatsapp-inbox',
      entry: 'run.mjs',
      runtime: 'node',
    }),
    ['node', '/opt/nixery/plugin/whatsapp-inbox/run.mjs'],
  );
});

test('resolveNixeryDefEntryArgv uses def.id as ability folder', () => {
  assert.deepEqual(
    resolveNixeryDefEntryArgv({
      id: 'whatsapp-inbox',
      packages: ['nodejs'],
      run: {
        entry: 'run.mjs',
        runtime: 'node',
      },
    }),
    ['node', '/opt/nixery/plugin/whatsapp-inbox/run.mjs'],
  );
});

test('resolveNixeryEntryArgv rejects path escape in entry', () => {
  assert.throws(() => resolveNixeryEntryArgv({
    abilityId: 'whatsapp-inbox',
    entry: '../lib/run-agent.mjs',
    runtime: 'node',
  }));
});
