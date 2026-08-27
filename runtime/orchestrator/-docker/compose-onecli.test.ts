import assert from 'node:assert/strict';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';

import { AGENT_YAHL_CONTAINER_DIR } from '@project-yahl/shared/nixery/ensure-plugin-links';

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

  it('bind-mounts task workspace and sets session env', async () => {
    previousHostRepoRoot = process.env.HOST_REPO_ROOT;
    const repoRoot = await mkdtemp(path.join(tmpdir(), 'yahl-compose-override-'));
    runtimeAgentsRoot = path.join(repoRoot, 'runtime', '.agents');
    process.env.HOST_REPO_ROOT = repoRoot;
    process.env.RUNTIME_REPO_ROOT = path.join(repoRoot, 'runtime');

    const sessionId = 'sess-mount';
    const taskId = 'hk_weather';

    await mkdir(path.join(repoRoot, 'data', 'workspace', 'tasks', taskId), { recursive: true });
    await writeFile(path.join(repoRoot, 'data', 'workspace', 'tasks', taskId, '.keep'), '');

    const overridePath = await writeAgentSessionOverride({
      sessionId,
      taskId,
    });
    const content = await readFile(overridePath, 'utf8');

    assert.match(content, /AGENT_SESSION_HOME: "\/workspace\/sessions\/sess-mount"/);
    assert.match(content, /AGENT_YAHL_DIR: "\/opt\/yahl"/);
    assert.match(
      content,
      new RegExp(
        `${path.join(repoRoot, 'data', 'workspace', 'tasks', taskId).replaceAll('/', '[/\\\\]')}`
        + ':/workspace/sessions/sess-mount/data:rw',
      ),
    );
    assert.doesNotMatch(content, new RegExp(`${AGENT_YAHL_CONTAINER_DIR}:ro`));
    assert.doesNotMatch(content, /\/opt\/skills/);
  });
});
