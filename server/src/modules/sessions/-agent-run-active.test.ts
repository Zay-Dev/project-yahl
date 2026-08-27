import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

describe('assertSessionRunAllowed browser abandon', () => {
  it('blocks resume when browserAbandonedAt is set', async () => {
    const source = await readFile(path.join(here, '-agent-run-active.ts'), 'utf8');

    assert.match(source, /browserAbandonedAt/);
    assert.match(source, /Session browser was abandoned/);
  });

  it('markSessionBrowserAbandoned supersedes pending checkpoints', async () => {
    const source = await readFile(path.join(here, '-abandon-browser-session.ts'), 'utf8');

    assert.match(source, /browserAbandonedAt/);
    assert.match(source, /status: 'superseded'/);
    assert.match(source, /\$unset: \{ runCursor/);
    assert.match(source, /clearSessionControl/);
  });
});
