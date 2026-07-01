import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

describe('rebuildPersistedPathsFromTopic', () => {
  it('builds persisted index from topic json files', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'yahl-knowledge-persisted-'));
    const topicDir = path.join(tmp, 'knowledges', 'demo-topic');

    process.env.MASTERMIND_DATA_ROOT = tmp;

    await fs.mkdir(topicDir, { recursive: true });
    await fs.writeFile(path.join(topicDir, 'meta.json'), '{}\n', 'utf8');
    await fs.writeFile(path.join(topicDir, 'learning_contract.json'), '{}\n', 'utf8');
    await fs.writeFile(path.join(topicDir, 'key_facts_md.md'), '# Facts\n', 'utf8');

    const { rebuildPersistedPathsFromTopic } = await import('./index.js');
    const persisted = await rebuildPersistedPathsFromTopic('demo-topic');

    assert.equal(persisted.length, 3);
    assert.deepEqual(
      persisted.map((entry) => entry.key).sort(),
      ['key_facts_md', 'learning_contract', 'meta'],
    );
    assert.equal(persisted.find((entry) => entry.key === 'key_facts_md')?.relativePath.endsWith('.md'), true);
    assert.equal(persisted[0]?.absolutePath.startsWith('~/knowledges/'), true);

    delete process.env.MASTERMIND_DATA_ROOT;
  });
});
