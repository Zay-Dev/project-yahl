import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, it } from 'node:test';

import { listInlineNixeryDefIds, listNixeryDefIds } from './list-defs';
import { resolveNixeryOutputSpec } from './output-contract';
import { loadNixeryDefFromFile } from './load-def';

const nixeryRoot = path.join(import.meta.dirname, '..', '..', 'server', 'nixery');

describe('listNixeryDefIds', () => {
  it('discovers defs with index.yml and skips underscore folders', async () => {
    const ids = await listNixeryDefIds(nixeryRoot);

    assert.ok(ids.length >= 1);
    assert.ok(!ids.some((id) => id.startsWith('_')));

    for (const defId of ids) {
      await fs.access(path.join(nixeryRoot, defId, 'index.yml'));
    }
  });
});

describe('listInlineNixeryDefIds', () => {
  it('returns only defs with output.inlineTool: true', async () => {
    const ids = await listInlineNixeryDefIds(nixeryRoot);
    const defs = await Promise.all(ids.map((defId) =>
      loadNixeryDefFromFile(path.join(nixeryRoot, defId, 'index.yml'))));

    assert.ok(defs.every((def) => resolveNixeryOutputSpec(def).inlineTool));
    assert.ok(ids.includes('resolve-error-with-knowledge'));
    assert.ok(!ids.includes('get-knowledge'));
    assert.ok(!ids.includes('search-knowledge'));
    assert.ok(defs.length >= 1);
  });
});
