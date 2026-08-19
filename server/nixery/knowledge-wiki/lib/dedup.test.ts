import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { applyDedupAction, resolveCanonicalFromPagePath } from './dedup.js';
import { isHoneableWikiPagePath } from './run-knowledge-manager.js';

describe('resolveCanonicalFromPagePath', () => {
  it('parses topic page paths', () => {
    assert.deepEqual(resolveCanonicalFromPagePath('topics/foo/facts'), {
      canonical: 'foo',
      page: 'facts',
    });
  });

  it('rejects topic-root paths', () => {
    assert.equal(resolveCanonicalFromPagePath('topics/foo'), null);
    assert.equal(
      resolveCanonicalFromPagePath('topics/full-backup-slack-workspace-files-dms'),
      null,
    );
  });
});

describe('applyDedupAction', () => {
  it('skips topic-root paths without throwing', async () => {
    const result = await applyDedupAction({
      action: 'collapse_all_sections',
      pagePath: 'topics/full-backup-slack-workspace-files-dms',
    });

    assert.equal(result.status, 'skipped');
    assert.equal(result.pagePath, 'topics/full-backup-slack-workspace-files-dms');
  });

  it('skips empty pagePath without throwing', async () => {
    const result = await applyDedupAction({
      action: 'collapse_all_sections',
      pagePath: '  ',
    });

    assert.equal(result.status, 'skipped');
  });
});

describe('isHoneableWikiPagePath', () => {
  it('rejects topic root and raw paths', () => {
    assert.equal(isHoneableWikiPagePath('topics/foo'), false);
    assert.equal(isHoneableWikiPagePath('topics/foo/raw/report'), false);
    assert.equal(isHoneableWikiPagePath('topics/foo/raw/observations/2026-08-04/x'), false);
  });

  it('accepts normal topic pages', () => {
    assert.equal(isHoneableWikiPagePath('topics/foo/facts', 'foo'), true);
    assert.equal(isHoneableWikiPagePath('topics/foo/overview', 'foo'), true);
  });
});
