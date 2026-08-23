import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

import {
  deleteWikiPage,
  ensureWikiPageAncestors,
  getWikiPageByPath,
  listWikiPagesUnderPrefix,
  upsertWikiPage,
} from './corpus-client.js';

const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'corpus-client-'));

before(() => {
  process.env.KNOWLEDGE_EXPORT_ROOT = tempRoot;
});

after(async () => {
  await fs.rm(tempRoot, { force: true, recursive: true });
});

describe('corpus-client', () => {
  it('upserts and reads a topic page under en/', async () => {
    const pagePath = 'topics/demo/overview';

    await upsertWikiPage({
      content: '# Overview\n\nHello corpus.',
      pagePath,
    });

    const page = await getWikiPageByPath(pagePath);

    assert.ok(page);
    assert.match(page.content, /Hello corpus/);
    assert.equal(page.path, pagePath);

    const absolute = path.join(tempRoot, 'en', 'topics', 'demo', 'overview.md');
    const raw = await fs.readFile(absolute, 'utf8');

    assert.match(raw, /Hello corpus/);
  });

  it('lists pages under a prefix', async () => {
    await upsertWikiPage({
      content: 'facts body',
      pagePath: 'topics/demo/facts',
    });

    const pages = await listWikiPagesUnderPrefix('topics/demo');

    assert.ok(pages.some((page) => page.path === 'topics/demo/overview'));
    assert.ok(pages.some((page) => page.path === 'topics/demo/facts'));
  });

  it('deletes a page', async () => {
    await upsertWikiPage({
      content: 'temporary',
      pagePath: 'topics/demo/temp-page',
    });

    const deleted = await deleteWikiPage('topics/demo/temp-page');

    assert.equal(deleted, true);
    assert.equal(await getWikiPageByPath('topics/demo/temp-page'), null);
  });

  it('creates export root and parent dirs on write without stub ancestor pages', async () => {
    const nestedRoot = path.join(tempRoot, 'nested-export');
    process.env.KNOWLEDGE_EXPORT_ROOT = nestedRoot;

    const pagePath = 'topics/inbox/raw/observations/2026-01-01/test-obs';

    await ensureWikiPageAncestors(pagePath);
    await upsertWikiPage({
      content: '# Observation\n',
      pagePath,
    });

    const absolute = path.join(
      nestedRoot,
      'en',
      'topics',
      'inbox',
      'raw',
      'observations',
      '2026-01-01',
      'test-obs.md',
    );

    assert.equal(await fs.access(absolute).then(() => true, () => false), true);
    assert.equal(
      await fs.access(path.join(nestedRoot, 'en', 'topics', 'inbox.md')).then(() => true, () => false),
      false,
    );
    assert.equal(await getWikiPageByPath('topics/inbox'), null);

    process.env.KNOWLEDGE_EXPORT_ROOT = tempRoot;
  });
});
