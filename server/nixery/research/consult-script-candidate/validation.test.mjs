import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import { validateOutput } from './validation.mjs';

describe('consult-script-candidate validation', () => {
  it('accepts advise and skip shapes', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'consult-script-'));
    const advisePath = path.join(dir, 'advise.json');
    const skipPath = path.join(dir, 'skip.json');

    await fs.writeFile(advisePath, JSON.stringify({
      action: 'advise',
      scriptId: 'extract-routes-normalize',
      kind: 'normalize',
      contract: 'coerce extract',
      reasons: ['next piece'],
      existingScripts: ['extract-routes'],
    }), 'utf8');

    await fs.writeFile(skipPath, JSON.stringify({
      action: 'skip',
      scriptId: null,
      kind: null,
      contract: null,
      reasons: ['nothing new'],
      existingScripts: [],
    }), 'utf8');

    assert.equal((await validateOutput({ outputPath: advisePath })).ok, true);
    assert.equal((await validateOutput({ outputPath: skipPath })).ok, true);
  });
});
