import assert from 'node:assert/strict';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { describe, it } from 'node:test';

describe('writeCrashReport', () => {
  it('writes a markdown crash report without LLM analysis', async () => {
    const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mastermind-crash-'));

    process.env.MASTERMIND_DATA_ROOT = dataRoot;

    const { writeCrashReport } = await import('./index.js');

    const reportPath = await writeCrashReport({
      caller: 'test',
      error: new Error('first failure'),
      skill: 'process',
    });

    const body = await fs.readFile(reportPath, 'utf8');

    assert.match(body, /# Mastermind crash report/);
    assert.match(body, /first failure/);
    assert.equal(body.includes('## Analysis'), false);

    delete process.env.MASTERMIND_DATA_ROOT;
  });
});
