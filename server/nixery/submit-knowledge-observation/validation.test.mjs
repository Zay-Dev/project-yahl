import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import { validateOutput } from './validation.mjs';

const writeGate = async (body) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'submit-obs-val-'));
  const outputPath = path.join(dir, 'result.json');

  await fs.writeFile(outputPath, `${JSON.stringify(body, null, 2)}\n`, 'utf8');

  return { dir, outputPath };
};

describe('submit-knowledge-observation validation.mjs', () => {
  it('accepts success gate with path', async () => {
    const { dir, outputPath } = await writeGate({
      ok: true,
      path: 'topics/traffic-monitor/raw/observations/2026-08-05/abc',
    });

    assert.deepEqual(await validateOutput({ outputPath }), { ok: true });

    await fs.rm(dir, { recursive: true, force: true });
  });

  it('accepts failed gate with error string', async () => {
    const { dir, outputPath } = await writeGate({
      ok: false,
      error: 'topic_hint is required',
    });

    assert.deepEqual(await validateOutput({ outputPath }), { ok: true });

    await fs.rm(dir, { recursive: true, force: true });
  });

  it('rejects failed gate without error', async () => {
    const { dir, outputPath } = await writeGate({ ok: false });

    assert.deepEqual(await validateOutput({ outputPath }), {
      ok: false,
      reason: 'failed gate requires error string',
    });

    await fs.rm(dir, { recursive: true, force: true });
  });

  it('rejects success gate without path', async () => {
    const { dir, outputPath } = await writeGate({ ok: true });

    assert.deepEqual(await validateOutput({ outputPath }), {
      ok: false,
      reason: 'success gate requires non-empty path string',
    });

    await fs.rm(dir, { recursive: true, force: true });
  });
});
