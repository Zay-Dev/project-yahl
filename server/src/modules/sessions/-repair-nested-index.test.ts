import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

describe('createRepairSession nestedIndex', () => {
  it('persists agentMeta.nestedIndex on repair runCursor', async () => {
    const source = await readFile(
      path.join(here, 'use-cases/repair-session-write.ts'),
      'utf8',
    );

    assert.match(source, /kind: 'repair'/);
    assert.match(source, /agentMeta\?\.nestedIndex/);
    assert.match(source, /nestedIndex: anchorRow\.agentMeta\.nestedIndex/);
  });
});
