import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import { validateOutput } from './validation.mjs';

const observation = {
  ok: true,
  observationId: 'error-a1b2c3d4e5f6',
  path: 'topics/inbox/raw/observations/2026-08-09/error-a1b2c3d4e5f6',
  topic: 'inbox',
};

const validate = async (body) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'resolve-error-val-'));
  const outputPath = path.join(dir, 'result.json');

  await fs.writeFile(outputPath, `${JSON.stringify(body, null, 2)}\n`, 'utf8');
  const result = await validateOutput({ outputPath });

  await fs.rm(dir, { recursive: true, force: true });

  return result;
};

describe('resolve-error-with-knowledge validation.mjs', () => {
  it('accepts found with solution and citations', async () => {
    assert.deepEqual(await validate({
      ok: true,
      status: 'found',
      solution: 'Retry with the documented selector.',
      citations: [{
        path: 'topics/browser/howto',
        excerpt: 'Use the stable selector before Submit.',
      }],
      observation,
    }), { ok: true });
  });

  it('accepts not_found and unavailable investigation results', async () => {
    for (const status of ['not_found', 'unavailable']) {
      assert.deepEqual(await validate({
        ok: true,
        status,
        solution: null,
        citations: [],
        message: 'Investigate, verify, and submit the working solution.',
        observation,
      }), { ok: true });
    }
  });

  it('accepts persistence failure with an error', async () => {
    assert.deepEqual(await validate({
      ok: false,
      error: 'observation upsert failed',
    }), { ok: true });
  });

  it('rejects found without a citation', async () => {
    assert.deepEqual(await validate({
      ok: true,
      status: 'found',
      solution: 'Uncited answer',
      citations: [],
      observation,
    }), {
      ok: false,
      reason: 'found result requires citations',
    });
  });
});
