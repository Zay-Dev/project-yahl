import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

describe('rebuildSourcesIndexFromStudies', () => {
  it('builds array index from study_*.json files', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'yahl-knowledge-rebuild-'));
    const topicDir = path.join(tmp, 'knowledges', 'demo-topic');

    process.env.MASTERMIND_DATA_ROOT = tmp;

    await fs.mkdir(topicDir, { recursive: true });
    await fs.writeFile(
      path.join(topicDir, 'study_alpha.json'),
      `${JSON.stringify({
        study_alpha: {
          studiedAt: '2026-06-22T00:00:00.000Z',
          studyMd: '# Alpha',
          title: 'Alpha',
          trustTier: 'high',
          url: 'https://example.com/alpha',
        },
      }, null, 2)}\n`,
      'utf8',
    );

    const { rebuildSourcesIndexFromStudies } = await import('./index.js');
    const sources = await rebuildSourcesIndexFromStudies('demo-topic');

    assert.equal(sources.length, 1);
    assert.equal(sources[0]?.studyKey, 'study_alpha');
    assert.equal(sources[0]?.url, 'https://example.com/alpha');

    delete process.env.MASTERMIND_DATA_ROOT;
  });
});
