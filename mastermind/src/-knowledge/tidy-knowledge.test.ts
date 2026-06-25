import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

describe('runTidyKnowledge', () => {
  it('merges duplicate topic folders on apply', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'yahl-tidy-knowledge-'));

    process.env.MASTERMIND_DATA_ROOT = tmp;

    const canonicalDir = path.join(tmp, 'knowledges', 'project-yahl-develop');
    const aliasDir = path.join(tmp, 'knowledges', 'yahl-develop');

    await fs.mkdir(canonicalDir, { recursive: true });
    await fs.mkdir(aliasDir, { recursive: true });
    await fs.writeFile(
      path.join(canonicalDir, 'learning_contract.json'),
      `${JSON.stringify({
        learning_contract: {
          topic: 'the project yahl (develop branch)',
          seedUrls: [],
        },
      }, null, 2)}\n`,
      'utf8',
    );
    await fs.writeFile(
      path.join(aliasDir, 'learning_contract.json'),
      `${JSON.stringify({
        learning_contract: {
          topic: 'the project yahl (develop branch)',
          seedUrls: [],
        },
      }, null, 2)}\n`,
      'utf8',
    );
    await fs.writeFile(
      path.join(canonicalDir, 'summary.json'),
      `${JSON.stringify({ summary: { summaryMd: '# Summary' } }, null, 2)}\n`,
      'utf8',
    );
    await fs.writeFile(
      path.join(aliasDir, 'facts.json'),
      `${JSON.stringify({ facts: { items: [{ claim: 'fact', sourceUrl: 'https://example.com', confidence: 'high' }] } }, null, 2)}\n`,
      'utf8',
    );

    const { runTidyKnowledge } = await import('./tidy-knowledge.js');
    const dryRun = await runTidyKnowledge({ dryRun: true });

    assert.equal(dryRun.groups.length, 1);
    assert.equal(dryRun.groups[0]?.canonical, 'project-yahl-develop');

    const applied = await runTidyKnowledge({ dryRun: false });

    assert.equal(applied.applied, true);
    assert.ok(await fs.stat(path.join(canonicalDir, 'facts.json')));
    assert.ok(await fs.stat(path.join(canonicalDir, 'summary.json')));

    const archiveRoot = path.join(tmp, 'knowledges', '_archive');
    const archived = await fs.readdir(archiveRoot);

    assert.equal(archived.some((name) => name.startsWith('yahl-develop')), true);

    delete process.env.MASTERMIND_DATA_ROOT;
  });
});
