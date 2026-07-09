import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

describe('tidy-knowledge skill', () => {
  let tmp = '';

  before(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'yahl-tidy-skill-'));
    process.env.MASTERMIND_DATA_ROOT = tmp;
    process.env.KNOWLEDGE_EXPORT_ROOT = path.join(tmp, 'knowledge_export');
    const exportDir = path.join(tmp, 'knowledge_export', 'en', 'topics', 'topic-a');
    await fs.mkdir(exportDir, { recursive: true });
    await fs.writeFile(path.join(exportDir, 'overview.md'), '# Topic A\n');
  });

  after(async () => {
    delete process.env.MASTERMIND_DATA_ROOT;
    delete process.env.KNOWLEDGE_EXPORT_ROOT;
    await fs.rm(tmp, { force: true, recursive: true });
  });

  it('returns report via runSkill without agent ready gate', async () => {
    const { runSkill } = await import('./skills.js');

    const result = await runSkill(
      {
        prompt: async () => ({ result: 'unused' }),
        status: 'unconfigured',
      },
      'tidy-knowledge',
      {
        args: { dryRun: true },
        caller: 'stage-agent',
        sessionId: 'sess-1',
      },
    );

    assert.equal(result.ok, true);
    assert.ok(result.data && typeof result.data === 'object');
    const data = result.data as { report?: { dryRun?: boolean; topicCount?: number; topics?: unknown[] } };
    assert.equal(data.report?.dryRun, true);
    assert.ok(typeof data.report?.topicCount === 'number');
    assert.ok(Array.isArray(data.report?.topics));
  });
});
