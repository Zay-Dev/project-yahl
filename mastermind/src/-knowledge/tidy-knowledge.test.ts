import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

describe('runTidyKnowledge', () => {
  it('audits wiki topics from export and registry', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'yahl-tidy-knowledge-'));
    const exportRoot = path.join(tmp, 'knowledge_export');

    process.env.MASTERMIND_DATA_ROOT = tmp;
    process.env.KNOWLEDGE_EXPORT_ROOT = exportRoot;

    const exportCanonical = path.join(exportRoot, 'en', 'topics', 'project-yahl-develop');

    await fs.mkdir(exportCanonical, { recursive: true });
    await fs.writeFile(
      path.join(exportCanonical, 'overview.md'),
      '# Project Yahl\n',
      'utf8',
    );

    const { runTidyKnowledge } = await import('./tidy-knowledge.js');
    const report = await runTidyKnowledge({ dryRun: true });

    assert.equal(report.dryRun, true);
    assert.ok(report.topicCount >= 1);
    assert.ok(report.topics.some((topic) => topic.canonical === 'project-yahl-develop'));

    delete process.env.MASTERMIND_DATA_ROOT;
    delete process.env.KNOWLEDGE_EXPORT_ROOT;
  });
});
