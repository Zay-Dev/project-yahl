import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

describe('stage-session browser keepalive', () => {
  it('does not close Stagehand after every stage', async () => {
    const source = await readFile(path.join(here, 'stage-session.ts'), 'utf8');

    assert.doesNotMatch(source, /closeStagehandSession/);
    assert.match(source, /runBrowserCommand/);
  });
});
