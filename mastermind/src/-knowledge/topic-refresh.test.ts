import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

describe('topic refresh', () => {
  it('marks topic due when enabled interval elapsed since lastRunAt', async () => {
    const { isTopicRefreshDue, normalizeRefreshPolicy } = await import('./topic-refresh.js');

    const entry = {
      aliases: [],
      canonical: 'dogfood-topic',
      createdAt: '2020-01-01T00:00:00.000Z',
      maxAgeDays: null,
      refresh: normalizeRefreshPolicy({
        enabled: true,
        interval: 'daily',
        lastRunAt: '2020-01-01T00:00:00.000Z',
        lastRunSessionId: null,
        lastRunStatus: null,
        scopes: ['facts', 'summary'],
      }),
      signals: { seedUrlHosts: [], seedUrlPaths: [], topicTexts: [] },
      updatedAt: '2020-01-01T00:00:00.000Z',
    };

    const due = isTopicRefreshDue(entry, undefined);

    assert.equal(due.due, true);
    assert.equal(due.interval, 'daily');
    assert.deepEqual(due.scopes, ['facts', 'summary']);
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

  it('throws when topic policy slug is unknown', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'yahl-resolve-topic-missing-'));

    process.env.MASTERMIND_DATA_ROOT = tmp;
    process.env.KNOWLEDGE_EXPORT_ROOT = path.join(tmp, 'knowledge_export');

    await fs.mkdir(path.join(tmp, 'knowledge_export', 'en', 'topics'), { recursive: true });
    await fs.writeFile(
      path.join(tmp, 'topics.json'),
      `${JSON.stringify({ topics: [] }, null, 2)}\n`,
      'utf8',
    );

    const { resolveTopicPolicy } = await import('./topic-refresh.js');

    await assert.rejects(
      () => resolveTopicPolicy('project yahl'),
      /Topic policy not found/,
    );

    delete process.env.MASTERMIND_DATA_ROOT;
    delete process.env.KNOWLEDGE_EXPORT_ROOT;
  });

  it('resolves topic policy by declared registry alias', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'yahl-resolve-topic-alias-'));

    process.env.MASTERMIND_DATA_ROOT = tmp;
    process.env.KNOWLEDGE_EXPORT_ROOT = path.join(tmp, 'knowledge_export');

    const exportDir = path.join(tmp, 'knowledge_export', 'en', 'topics', 'project-yahl-develop');

    await fs.mkdir(exportDir, { recursive: true });
    await fs.writeFile(path.join(exportDir, 'overview.md'), '# Project Yahl\n', 'utf8');
    await fs.writeFile(
      path.join(tmp, 'topics.json'),
      `${JSON.stringify({
        topics: [{
          aliases: ['yahl-develop'],
          canonical: 'project-yahl-develop',
          createdAt: '2020-01-01T00:00:00.000Z',
          maxAgeDays: null,
          refresh: {
            enabled: true,
            interval: 'daily',
            lastRunAt: null,
            lastRunSessionId: null,
            lastRunStatus: null,
            scopes: ['studies', 'facts', 'synthesis', 'summary'],
          },
          signals: { seedUrlHosts: [], seedUrlPaths: [], topicTexts: [] },
          updatedAt: '2020-01-01T00:00:00.000Z',
        }],
      }, null, 2)}\n`,
      'utf8',
    );

    const { resolveTopicPolicy } = await import('./topic-refresh.js');
    const resolved = await resolveTopicPolicy('yahl-develop');

    assert.equal(resolved.row.canonical, 'project-yahl-develop');
    assert.equal(resolved.refresh_skipped, false);

    delete process.env.MASTERMIND_DATA_ROOT;
    delete process.env.KNOWLEDGE_EXPORT_ROOT;
  });

  it('resolves topic policy without skipping when enabled with null interval', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'yahl-resolve-topic-policy-'));

    process.env.MASTERMIND_DATA_ROOT = tmp;
    process.env.KNOWLEDGE_EXPORT_ROOT = path.join(tmp, 'knowledge_export');

    const exportDir = path.join(tmp, 'knowledge_export', 'en', 'topics', 'lego-story-of-reckless-ben');

    await fs.mkdir(exportDir, { recursive: true });
    await fs.writeFile(path.join(exportDir, 'overview.md'), '# Lego\n', 'utf8');
    await fs.writeFile(
      path.join(tmp, 'topics.json'),
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

    await fs.writeFile(
      path.join(tmp, 'topics.json'),
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
