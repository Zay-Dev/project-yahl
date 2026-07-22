import assert from 'node:assert/strict';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { describe, it } from 'node:test';

describe('self-check', () => {
  it('passes when data dirs are writable', async () => {
    const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mastermind-self-check-'));

    process.env.MASTERMIND_DATA_ROOT = dataRoot;

    await Promise.all([
      'crash-reports',
      'docs',
      'knowledges',
      'rules',
      'store',
    ].map((name) => fs.mkdir(path.join(dataRoot, name), { recursive: true })));

    const { runSelfCheck } = await import('./self-check.js');
    const result = await runSelfCheck();

    assert.equal(result.ok, true);
    assert.equal(result.checks.dataDirs, 'ok');

    delete process.env.MASTERMIND_DATA_ROOT;
  });
});
