import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

describe('topic registry', () => {
  it('resolves canonical slug by normalized topic text across folders', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'yahl-topic-registry-'));

    process.env.MASTERMIND_DATA_ROOT = tmp;

    const primaryDir = path.join(tmp, 'knowledges', 'project-yahl-develop');
    const aliasDir = path.join(tmp, 'knowledges', 'project-yahl-develop-branch');

    await fs.mkdir(primaryDir, { recursive: true });
    await fs.mkdir(aliasDir, { recursive: true });
    await fs.writeFile(
      path.join(primaryDir, 'learning_contract.json'),
      `${JSON.stringify({
        learning_contract: {
          topic: 'the project yahl (develop branch)',
          seedUrls: ['https://github.com/Zay-Dev/project-yahl'],
        },
      }, null, 2)}\n`,
      'utf8',
    );
    await fs.writeFile(
      path.join(aliasDir, 'learning_contract.json'),
      `${JSON.stringify({
        learning_contract: {
          topic: 'the project yahl (develop branch)',
          seedUrls: ['https://github.com/Zay-Dev/project-yahl/tree/develop'],
        },
      }, null, 2)}\n`,
      'utf8',
    );

    const { resolveCanonicalTopic } = await import('./topic-registry.js');
    const resolved = await resolveCanonicalTopic({
      slug: 'project-yahl-develop-branch',
      topicText: 'the project yahl (develop branch)',
    });

    assert.equal(resolved.matchedBy, 'slug');
    assert.equal(resolved.canonical, 'project-yahl-develop-branch');

    delete process.env.MASTERMIND_DATA_ROOT;
  });

  it('registers and resolves aliases from registry', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'yahl-topic-registry-alias-'));

    process.env.MASTERMIND_DATA_ROOT = tmp;

    const { addAlias, expandTopicSlugs, registerTopic, resolveCanonicalTopic } = await import('./topic-registry.js');

    await registerTopic('project-yahl-develop', {
      topicTexts: ['the project yahl (develop branch)'],
    });
    await addAlias('project-yahl-develop', 'yahl-develop');

    const resolved = await resolveCanonicalTopic({ slug: 'yahl-develop' });
    const slugs = await expandTopicSlugs('yahl-develop');

    assert.equal(resolved.canonical, 'project-yahl-develop');
    assert.deepEqual(slugs.sort(), ['project-yahl-develop', 'yahl-develop'].sort());

    delete process.env.MASTERMIND_DATA_ROOT;
  });
});
