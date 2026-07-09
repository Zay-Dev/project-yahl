import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

describe('read-export-corpus', () => {
  it('lists markdown files from bare topics/ export path', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'yahl-read-export-corpus-'));

    process.env.KNOWLEDGE_EXPORT_ROOT = path.join(tmp, 'knowledge_export');

    const bareDir = path.join(tmp, 'knowledge_export', 'topics', 'lego-story-of-reckless-ben');

    await fs.mkdir(bareDir, { recursive: true });
    await fs.writeFile(
      path.join(bareDir, 'overview.md'),
      '# Overview\n\nLego reckless ben.\n',
      'utf8',
    );
    await fs.writeFile(
      path.join(bareDir, 'facts.md'),
      '# Facts\n\n- Fact one\n',
      'utf8',
    );

    const { getExportTopicStats, listExportTopicFiles, readExportTopicCorpus } = await import('./read-export-corpus.js');
    const files = await listExportTopicFiles('lego-story-of-reckless-ben');
    const stats = await getExportTopicStats('lego-story-of-reckless-ben');
    const corpus = await readExportTopicCorpus('lego-story-of-reckless-ben');

    assert.equal(files.length, 2);
    assert.equal(stats.fileCount, 2);
    assert.ok(corpus.includes('Lego reckless ben'));
    assert.ok(corpus.includes('Fact one'));

    delete process.env.KNOWLEDGE_EXPORT_ROOT;
  });
});
