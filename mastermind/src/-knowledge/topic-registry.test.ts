import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

describe('topic registry', () => {
  it('resolves canonical slug by normalized topic text across export topic folders', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'yahl-topic-registry-'));

    process.env.MASTERMIND_DATA_ROOT = tmp;
    process.env.KNOWLEDGE_EXPORT_ROOT = path.join(tmp, 'knowledge_export');

    const primaryDir = path.join(tmp, 'knowledge_export', 'en', 'topics', 'project-yahl-develop');
    const aliasDir = path.join(tmp, 'knowledge_export', 'en', 'topics', 'project-yahl-develop-branch');

    await fs.mkdir(primaryDir, { recursive: true });
    await fs.mkdir(aliasDir, { recursive: true });
    await fs.writeFile(
      path.join(primaryDir, 'overview.md'),
      '# Project YAHL\n\nhttps://github.com/Zay-Dev/project-yahl\n',
      'utf8',
    );
    await fs.writeFile(
      path.join(aliasDir, 'overview.md'),
      '# Project YAHL develop\n\nhttps://github.com/Zay-Dev/project-yahl/tree/develop\n',
      'utf8',
    );

    const { resolveCanonicalTopic } = await import('./topic-registry.js');
    const resolved = await resolveCanonicalTopic({
      slug: 'project-yahl-develop-branch',
      topicText: 'the project yahl (develop branch)',
    });

    assert.equal(resolved.matchedBy, 'slug');
    assert.equal(resolved.canonical, 'project-yahl-develop-branch');

    delete process.env.KNOWLEDGE_EXPORT_ROOT;
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

  it('discovers topic folders under bare topics/ export path', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'yahl-topic-registry-bare-topics-'));

    process.env.MASTERMIND_DATA_ROOT = tmp;
    process.env.KNOWLEDGE_EXPORT_ROOT = path.join(tmp, 'knowledge_export');

    const bareDir = path.join(tmp, 'knowledge_export', 'topics', 'lego-story-of-reckless-ben');

    await fs.mkdir(bareDir, { recursive: true });
    await fs.writeFile(
      path.join(bareDir, 'overview.md'),
      '# Lego Story\n\nReckless Ben overview.\n',
      'utf8',
    );

    const { listTopicFolderSummaries } = await import('./topic-registry.js');
    const summaries = await listTopicFolderSummaries();

    assert.equal(summaries.some((item) => item.slug === 'lego-story-of-reckless-ben'), true);

    delete process.env.KNOWLEDGE_EXPORT_ROOT;
    delete process.env.MASTERMIND_DATA_ROOT;
  });
});
