import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

describe('runTidyKnowledge', () => {
  it('merges duplicate topic folders on apply', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'yahl-tidy-knowledge-'));
    const exportRoot = path.join(tmp, 'knowledge_export');
    const seedUrl = 'https://example.com/project-yahl-develop';

    process.env.MASTERMIND_DATA_ROOT = tmp;
    process.env.KNOWLEDGE_EXPORT_ROOT = exportRoot;

    const exportCanonical = path.join(exportRoot, 'en', 'topics', 'project-yahl-develop');
    const exportAlias = path.join(exportRoot, 'en', 'topics', 'yahl-develop');

    await fs.mkdir(exportCanonical, { recursive: true });
    await fs.mkdir(exportAlias, { recursive: true });
    await fs.writeFile(
      path.join(exportCanonical, 'overview.md'),
      `# Project Yahl\n\nSeed: ${seedUrl}\n`,
      'utf8',
    );
    await fs.writeFile(
      path.join(exportCanonical, 'facts.md'),
      '# Facts\n',
      'utf8',
    );
    await fs.writeFile(
      path.join(exportAlias, 'overview.md'),
      `# Yahl develop\n\nSeed: ${seedUrl}\n`,
      'utf8',
    );

    const canonicalDir = path.join(tmp, 'knowledges', 'project-yahl-develop');
    const aliasDir = path.join(tmp, 'knowledges', 'yahl-develop');

    await fs.mkdir(canonicalDir, { recursive: true });
    await fs.mkdir(aliasDir, { recursive: true });
    await fs.writeFile(
      path.join(canonicalDir, 'summary.json'),
      `${JSON.stringify({ summary: { summaryMd: '# Summary' } }, null, 2)}\n`,
      'utf8',
    );
    await fs.writeFile(
      path.join(aliasDir, 'facts.json'),
      `${JSON.stringify({ facts: { items: [{ claim: 'fact', sourceUrl: seedUrl, confidence: 'high' }] } }, null, 2)}\n`,
      'utf8',
    );

    const { runTidyKnowledge } = await import('./tidy-knowledge.js');
    const dryRun = await runTidyKnowledge({ dryRun: true, skipWiki: true });

    assert.equal(dryRun.groups.length, 1);
    assert.equal(dryRun.groups[0]?.canonical, 'project-yahl-develop');

    const applied = await runTidyKnowledge({ dryRun: false, skipWiki: true });

    assert.equal(applied.applied, true);
    assert.ok(await fs.stat(path.join(canonicalDir, 'facts.json')));
    assert.ok(await fs.stat(path.join(canonicalDir, 'summary.json')));

    const archiveRoot = path.join(tmp, 'knowledges', '_archive');
    const archived = await fs.readdir(archiveRoot);

    assert.equal(archived.some((name) => name.startsWith('yahl-develop')), true);

    delete process.env.MASTERMIND_DATA_ROOT;
    delete process.env.KNOWLEDGE_EXPORT_ROOT;
  });

  it('merges registry canonical slugs with export slugs for wiki audit', async () => {
    const { resolveWikiAuditSlugs } = await import('./tidy-knowledge.js');

    const slugs = resolveWikiAuditSlugs(
      [{ slug: 'export-topic' } as import('./topic-registry.js').TTopicFolderSummary],
      [{ canonical: 'registry-only-topic' } as import('./topic-registry.js').TTopicRegistryEntry],
    );

    assert.deepEqual(slugs.sort(), ['export-topic', 'registry-only-topic']);
  });
});
