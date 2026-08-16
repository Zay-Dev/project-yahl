import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import { validateOutput } from './validation.mjs';

describe('get-knowledge validation.mjs', () => {
  it('rejects missing output file', async () => {
    const result = await validateOutput({
      outputPath: path.join(os.tmpdir(), 'missing-identity.md'),
    });

    assert.deepEqual(result, { ok: false, reason: 'output file missing' });
  });

  it('rejects too-short output', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'get-knowledge-val-'));
    const outputPath = path.join(dir, 'identity.md');

    await fs.writeFile(outputPath, 'short', 'utf8');

    const result = await validateOutput({ outputPath });

    assert.deepEqual(result, { ok: false, reason: 'output too short' });

    await fs.rm(dir, { recursive: true, force: true });
  });

  it('accepts substantive markdown output', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'get-knowledge-val-'));
    const outputPath = path.join(dir, 'identity.md');
    const fixture = [
      '---',
      'absent: false',
      '---',
      '# Identity Brief',
      '',
      'Substantive markdown content for validation gate.',
    ].join('\n');

    await fs.writeFile(outputPath, fixture, 'utf8');

    const result = await validateOutput({ outputPath });

    assert.deepEqual(result, { ok: true });

    await fs.rm(dir, { recursive: true, force: true });
  });
});
