import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

describe('topic refresh', () => {
  it('marks topic due when enabled interval elapsed since lastRunAt', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'yahl-topic-refresh-'));

    process.env.MASTERMIND_DATA_ROOT = tmp;

    const topicDir = path.join(tmp, 'knowledges', 'dogfood-topic');

    await fs.mkdir(topicDir, { recursive: true });
    await fs.mkdir(path.join(tmp, 'knowledges', '_index'), { recursive: true });
    await fs.writeFile(
      path.join(topicDir, 'meta.json'),
      `${JSON.stringify({ meta: { slug: 'dogfood-topic', updated_at: '2020-01-01T00:00:00.000Z' } }, null, 2)}\n`,
      'utf8',
    );
    await fs.writeFile(
      path.join(tmp, 'knowledges', '_index', 'topics.json'),
      `${JSON.stringify({
        topics: [{
          aliases: [],
          canonical: 'dogfood-topic',
          createdAt: '2020-01-01T00:00:00.000Z',
          maxAgeDays: null,
          refresh: {
            enabled: true,
            interval: 'daily',
            lastRunAt: '2020-01-01T00:00:00.000Z',
            lastRunSessionId: null,
            lastRunStatus: null,
            scopes: ['facts', 'summary'],
          },
          signals: { seedUrlHosts: [], seedUrlPaths: [], topicTexts: [] },
          updatedAt: '2020-01-01T00:00:00.000Z',
        }],
      }, null, 2)}\n`,
      'utf8',
    );

    const { evaluateKnowledgeRefresh } = await import('./topic-refresh.js');
    const report = await evaluateKnowledgeRefresh();

    assert.equal(report.staleTopics.length, 1);
    assert.equal(report.staleTopics[0]?.canonical, 'dogfood-topic');
    assert.deepEqual(report.staleTopics[0]?.scopes, ['facts', 'summary']);

    delete process.env.MASTERMIND_DATA_ROOT;
  });

  it('skips topics with refresh disabled or null interval', async () => {
    const { isTopicRefreshDue, normalizeRefreshPolicy } = await import('./topic-refresh.js');

    const entry = {
      aliases: [],
      canonical: 'off-topic',
      createdAt: '2020-01-01T00:00:00.000Z',
      maxAgeDays: null,
      refresh: normalizeRefreshPolicy({
        enabled: false,
        interval: 'weekly',
        lastRunAt: null,
        lastRunSessionId: null,
        lastRunStatus: null,
        scopes: ['summary'],
      }),
      signals: { seedUrlHosts: [], seedUrlPaths: [], topicTexts: [] },
      updatedAt: '2020-01-01T00:00:00.000Z',
    };

    assert.equal(isTopicRefreshDue(entry, undefined).due, false);
    assert.equal(
      isTopicRefreshDue({
        ...entry,
        refresh: normalizeRefreshPolicy({ enabled: true, interval: null }),
      }, undefined).due,
      false,
    );
  });

  it('resolves topic policy without skipping when enabled with null interval', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'yahl-resolve-topic-policy-'));

    process.env.MASTERMIND_DATA_ROOT = tmp;
    process.env.KNOWLEDGE_EXPORT_ROOT = path.join(tmp, 'knowledge_export');

    await fs.mkdir(path.join(tmp, 'knowledges', '_index'), { recursive: true });
    await fs.writeFile(
      path.join(tmp, 'knowledges', '_index', 'topics.json'),
      `${JSON.stringify({
        topics: [{
          aliases: [],
          canonical: 'lego-story-of-reckless-ben',
          createdAt: '2020-01-01T00:00:00.000Z',
          maxAgeDays: null,
          refresh: {
            enabled: true,
            interval: null,
            lastRunAt: null,
            lastRunSessionId: null,
            lastRunStatus: null,
            scopes: ['summary'],
          },
          signals: { seedUrlHosts: [], seedUrlPaths: [], topicTexts: [] },
          updatedAt: '2020-01-01T00:00:00.000Z',
        }],
      }, null, 2)}\n`,
      'utf8',
    );

    const { resolveTopicPolicy } = await import('./topic-refresh.js');
    const resolved = await resolveTopicPolicy('lego-story-of-reckless-ben');

    assert.equal(resolved.refresh_skipped, false);
    assert.equal(resolved.row.refresh?.enabled, true);
    assert.equal(resolved.row.refresh?.interval, null);

    delete process.env.MASTERMIND_DATA_ROOT;
    delete process.env.KNOWLEDGE_EXPORT_ROOT;
  });

  it('patches refresh policy for canonical slug', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'yahl-topic-refresh-patch-'));

    process.env.MASTERMIND_DATA_ROOT = tmp;

    await fs.mkdir(path.join(tmp, 'knowledges', '_index'), { recursive: true });
    await fs.writeFile(
      path.join(tmp, 'knowledges', '_index', 'topics.json'),
      `${JSON.stringify({ topics: [] }, null, 2)}\n`,
      'utf8',
    );

    const { patchTopicPolicy } = await import('./topic-refresh.js');
    const row = await patchTopicPolicy('new-topic', { enabled: true, interval: 'weekly' });

    assert.equal(row.canonical, 'new-topic');
    assert.equal(row.refresh?.enabled, true);
    assert.equal(row.refresh?.interval, 'weekly');

    delete process.env.MASTERMIND_DATA_ROOT;
  });
});
