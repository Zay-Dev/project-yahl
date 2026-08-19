import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import { validateOutput } from './validation.mjs';

describe('stage-verify validation', () => {
  const withTempResult = async (result, fn) => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'stage-verify-'));
    const outputPath = path.join(dir, 'result.json');

    await fs.writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');

    try {
      return await fn(outputPath);
    } finally {
      await fs.rm(dir, { force: true, recursive: true });
    }
  };

  it('accepts a normal pass result', async () => {
    await withTempResult({
      feedback: 'ok',
      pass: true,
      score: 1,
    }, async (outputPath) => {
      assert.deepEqual(await validateOutput({ outputPath }), { ok: true });
    });
  });

  it('rejects unavailable so output.retry can fire', async () => {
    await withTempResult({
      feedback: 'Unexpected end of JSON input',
      pass: false,
      score: 0,
      unavailable: true,
    }, async (outputPath) => {
      assert.deepEqual(await validateOutput({ outputPath }), {
        ok: false,
        reason: 'Unexpected end of JSON input',
      });
    });
  });

  it('rejects unavailable with default reason when feedback empty', async () => {
    await withTempResult({
      feedback: '   ',
      pass: false,
      score: 0,
      unavailable: true,
    }, async (outputPath) => {
      assert.deepEqual(await validateOutput({ outputPath }), {
        ok: false,
        reason: 'verify unavailable',
      });
    });
  });
});
