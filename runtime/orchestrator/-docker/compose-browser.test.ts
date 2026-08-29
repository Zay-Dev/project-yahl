import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mkdir, mkdtemp, rm, utimes, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';

import {
  BROWSER_ACTIVE_MARKER,
  browserActiveMarkerPath,
  browserCdpUrl,
  isBrowserIdle,
  resolveBrowserContainerName,
} from './compose-browser';

describe('compose-browser helpers', () => {
  it('names CDP URL and container from session id', () => {
    assert.equal(resolveBrowserContainerName('abc'), 'browser-abc');
    assert.equal(browserCdpUrl('abc'), 'http://browser-abc:9222');
    assert.equal(BROWSER_ACTIVE_MARKER, '.yahl-browser-active');
  });

  it('treats missing or stale activity marker as idle', async () => {
    const previous = process.env.HOST_REPO_ROOT;
    const repoRoot = await mkdtemp(path.join(tmpdir(), 'yahl-browser-idle-'));

    try {
      process.env.HOST_REPO_ROOT = repoRoot;

      assert.equal(await isBrowserIdle('missing'), true);

      const marker = browserActiveMarkerPath('sess-fresh');
      await mkdir(path.dirname(marker), { recursive: true });
      await writeFile(marker, `${new Date().toISOString()}\n`, 'utf8');
      assert.equal(await isBrowserIdle('sess-fresh'), false);

      const stale = browserActiveMarkerPath('sess-stale');
      await mkdir(path.dirname(stale), { recursive: true });
      await writeFile(stale, 'old\n', 'utf8');
      const old = new Date(Date.now() - 86_400_000 - 60_000);
      await utimes(stale, old, old);
      assert.equal(await isBrowserIdle('sess-stale'), true);
    } finally {
      process.env.HOST_REPO_ROOT = previous;
      await rm(repoRoot, { force: true, recursive: true });
    }
  });
});
