import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

describe('resolveKnowledgeWritePath basename-only', () => {
  it('creates facts.json when scope.json content mentions the word facts', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'yahl-knowledge-'));
    const topicDir = path.join(tmp, 'knowledges', 'test-topic');

    process.env.MASTERMIND_DATA_ROOT = tmp;

    await fs.mkdir(topicDir, { recursive: true });
    await fs.writeFile(
      path.join(topicDir, 'scope.json'),
      `${JSON.stringify({
        scope: {
          exclusions: ['No unverified claims presented as facts'],
        },
      }, null, 2)}\n`,
      'utf8',
    );

    const { findKnowledgeFileByBasename, resolveKnowledgeWritePath } = await import('./index.js');

    assert.equal(await findKnowledgeFileByBasename('facts', 'test-topic'), null);

    const { absolute, relative } = await resolveKnowledgeWritePath('facts', 'test-topic');

    assert.match(relative, /test-topic\/facts\.json$/);

    await fs.writeFile(absolute, `${JSON.stringify({ facts: { items: [] } }, null, 2)}\n`, 'utf8');

    assert.equal(await findKnowledgeFileByBasename('facts', 'test-topic'), absolute);
    assert.ok((await findKnowledgeFileByBasename('scope', 'test-topic'))?.endsWith('scope.json'));

    delete process.env.MASTERMIND_DATA_ROOT;
  });
});
