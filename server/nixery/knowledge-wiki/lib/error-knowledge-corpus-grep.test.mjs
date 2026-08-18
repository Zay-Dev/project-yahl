import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import {
  MAX_CANDIDATE_FILES,
  MAX_EXCERPT_CHARS,
  buildCorpusGrepQueries,
  grepKnowledgeCorpus,
  isExcludedCorpusPath,
  rankCorpusCandidate,
  tokenizeDistinctive,
} from './error-knowledge-corpus-grep.mjs';

const writeCorpusFile = async (root, relPath, content) => {
  const target = path.join(root, relPath);

  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content, 'utf8');
};

describe('buildCorpusGrepQueries', () => {
  it('includes tool id, last path segment, and short cue', () => {
    assert.deepEqual(
      buildCorpusGrepQueries({
        tool: 'platform/propose-notification',
        cue: 'propose-notification returned ok:false Error',
        claim: 'need direction to_user and body',
      }),
      [
        'platform/propose-notification',
        'propose-notification',
        'propose-notification returned ok:false Error',
        'need direction to_user and body',
        'direction',
        'to_user',
        'body',
      ],
    );
  });

  it('skips empty values and generic tokens', () => {
    assert.deepEqual(
      buildCorpusGrepQueries({
        tool: '  ',
        cue: '',
        claim: 'the and for with that',
      }),
      [],
    );
    assert.deepEqual(tokenizeDistinctive('the and for with that'), []);
  });

  it('tokenizes a long claim instead of grepping the whole phrase', () => {
    const claim = `${'kind title notifyName extra fields are rejected '.repeat(6)}schema`;
    const queries = buildCorpusGrepQueries({
      claim,
      tool: 'platform',
    });

    assert.ok(!queries.includes(claim.trim()));
    assert.ok(queries.includes('platform'));
    assert.ok(queries.includes('kind'));
    assert.ok(queries.includes('title'));
    assert.ok(queries.includes('notifyname'));
    assert.ok(queries.includes('schema'));
  });
});

describe('isExcludedCorpusPath', () => {
  it('matches the observation path with and without .md', () => {
    const excluded = 'topics/platform-notifications/raw/observations/2026-08-18/error-4f94cea86e13';

    assert.equal(
      isExcludedCorpusPath(`${excluded}.md`, excluded),
      true,
    );
    assert.equal(isExcludedCorpusPath(excluded, excluded), true);
    assert.equal(
      isExcludedCorpusPath('topics/platform/facts.md', excluded),
      false,
    );
  });
});

describe('grepKnowledgeCorpus', () => {
  it('returns unique files, excludes the new observation, and caps excerpt length', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'error-knowledge-grep-'));
    const excluded = 'topics/platform-notifications/raw/observations/2026-08-18/error-4f94cea86e13';
    const longLine = `propose-notification ${'x'.repeat(MAX_EXCERPT_CHARS + 80)}`;

    try {
      await writeCorpusFile(
        root,
        'topics/platform/facts.md',
        'HOWTO: propose-notification accepts exactly {channel, to, direction, body}\n',
      );
      await writeCorpusFile(
        root,
        `${excluded}.md`,
        'propose-notification rejected the args shape I passed\n',
      );
      await writeCorpusFile(
        root,
        'topics/inbox/facts.md',
        `${longLine}\n`,
      );

      const hits = await grepKnowledgeCorpus({
        excludedPath: excluded,
        root,
        tool: 'platform/propose-notification',
        cue: 'unused-cue-that-will-not-match',
        claim: 'unused-claim-token-zzzz',
      });
      const paths = hits.map((hit) => hit.path);

      assert.ok(paths.includes('topics/platform/facts.md'));
      assert.ok(paths.includes('topics/inbox/facts.md'));
      assert.ok(!paths.some((item) => item.includes('error-4f94cea86e13')));
      assert.equal(
        hits.find((hit) => hit.path === 'topics/inbox/facts.md')?.excerpt.length,
        MAX_EXCERPT_CHARS,
      );
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('caps unique files', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'error-knowledge-grep-cap-'));

    try {
      for (let index = 0; index < MAX_CANDIDATE_FILES + 5; index += 1) {
        await writeCorpusFile(
          root,
          `topics/inbox/hit-${String(index).padStart(2, '0')}.md`,
          'shared-token reusable how-to\n',
        );
      }

      const hits = await grepKnowledgeCorpus({
        queries: ['shared-token'],
        root,
      });

      assert.equal(hits.length, MAX_CANDIDATE_FILES);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('keeps HOWTO facts ahead of error observations when capping', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'error-knowledge-grep-rank-'));

    try {
      await writeCorpusFile(
        root,
        'topics/platform/facts.md',
        'HOWTO: propose-notification accepts exactly {channel, to, direction, body}\n',
      );

      for (let index = 0; index < 8; index += 1) {
        await writeCorpusFile(
          root,
          `topics/inbox/raw/observations/error-${index}.md`,
          'propose-notification returned ok:false Error\n',
        );
      }

      const hits = await grepKnowledgeCorpus({
        maxFiles: 3,
        queries: ['propose-notification'],
        root,
      });
      const paths = hits.map((hit) => hit.path);

      assert.equal(hits.length, 3);
      assert.equal(paths[0], 'topics/platform/facts.md');
      assert.ok(rankCorpusCandidate(
        { path: 'topics/platform/facts.md', excerpt: 'HOWTO propose-notification' },
        'platform/propose-notification',
      ) > rankCorpusCandidate(
        { path: 'topics/inbox/raw/observations/error-1.md', excerpt: 'failed' },
        'platform/propose-notification',
      ));
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});
