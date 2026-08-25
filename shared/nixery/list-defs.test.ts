import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, it } from 'node:test';

import { listNixeryDefIds, resolveNixeryAbilityLocation } from './list-defs';

const nixeryRoot = path.join(import.meta.dirname, '..', '..', 'server', 'nixery');

describe('listNixeryDefIds', () => {
  it('discovers abilities under plugins and skips underscore folders', async () => {
    const ids = await listNixeryDefIds(nixeryRoot);

    assert.ok(ids.length >= 1);
    assert.ok(!ids.some((id) => id.startsWith('_')));

    for (const defId of ids) {
      const location = await resolveNixeryAbilityLocation(nixeryRoot, defId);

      await fs.access(location.indexPath);
      await fs.access(path.join(location.pluginDir, 'plugin.yml'));
    }
  });
});
