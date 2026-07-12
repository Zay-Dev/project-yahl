import assert from 'node:assert/strict';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';

import { writeAgentSessionOverride } from './compose-onecli';

describe('writeAgentSessionOverride', () => {
  let runtimeAgentsRoot = '';
  let previousHostRepoRoot: string | undefined;

  after(async () => {
    process.env.HOST_REPO_ROOT = previousHostRepoRoot;

    if (runtimeAgentsRoot) {
      await rm(runtimeAgentsRoot, { force: true, recursive: true });
    }
  });

  it('bind-mounts task workspace to session ~/data', async () => {
    previousHostRepoRoot = process.env.HOST_REPO_ROOT;
    const repoRoot = await mkdtemp(path.join(tmpdir(), 'yahl-compose-override-'));
    runtimeAgentsRoot = path.join(repoRoot, 'runtime', '.agents');
    process.env.HOST_REPO_ROOT = repoRoot;
    process.env.RUNTIME_REPO_ROOT = path.join(repoRoot, 'runtime');

    const sessionId = 'sess-mount';
    const taskId = 'hk_weather';
    const overridePath = await writeAgentSessionOverride({ sessionId, taskId });
    const content = await readFile(overridePath, 'utf8');

    assert.match(content, /AGENT_SESSION_HOME: "\/workspace\/sessions\/sess-mount"/);
    assert.match(
      content,
      new RegExp(
        `${path.join(repoRoot, 'data', 'workspace', 'tasks', taskId).replaceAll('/', '[/\\\\]')}`
        + ':/workspace/sessions/sess-mount/data:rw',
      ),
    );
  });
});
