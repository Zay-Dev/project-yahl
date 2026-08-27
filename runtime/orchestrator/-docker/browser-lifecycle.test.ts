import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

describe('ask-user / pause browser lifecycle', () => {
  it('shutdownAgent only tears down the agent compose project', async () => {
    const source = await readFile(path.join(here, 'agent-lifecycle.ts'), 'utf8');

    assert.match(source, /composeDown/);
    assert.doesNotMatch(source, /shutdownBrowser|abandonBrowserSession|ensureBrowser/);
  });

  it('ask-user pause path does not abandon the browser sidecar', async () => {
    const source = await readFile(path.join(here, '../-ask-user/index.ts'), 'utf8');

    assert.match(source, /shutdownAgent/);
    assert.doesNotMatch(source, /shutdownBrowser|abandonBrowserSession/);
  });
});
