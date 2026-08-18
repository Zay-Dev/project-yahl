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

  it('bind-mounts task workspace, YAHL, and plugin skill overlays', async () => {
    previousHostRepoRoot = process.env.HOST_REPO_ROOT;
    const repoRoot = await mkdtemp(path.join(tmpdir(), 'yahl-compose-override-'));
    runtimeAgentsRoot = path.join(repoRoot, 'runtime', '.agents');
    process.env.HOST_REPO_ROOT = repoRoot;
    process.env.RUNTIME_REPO_ROOT = path.join(repoRoot, 'runtime');

    const sessionId = 'sess-mount';
    const taskId = 'hk_weather';
    const skillSrc = path.join(repoRoot, 'server', 'nixery', 'fixture', 'SKILLS', 'nixery');
    const promptSrc = path.join(repoRoot, 'server', 'nixery', 'fixture', 'prompts', 'nixery.md');
    const persistSrc = path.join(
      repoRoot,
      'server',
      'nixery',
      'fixture',
      'prompts',
      'knowledge-persist.md',
    );

    const overridePath = await writeAgentSessionOverride({
      pluginInstalls: [
        {
          basename: 'nixery',
          containerDest: '/opt/skills/nixery',
          destAbs: path.join(repoRoot, 'runtime', 'orchestrator', 'SKILLS', 'nixery'),
          destRel: 'runtime/orchestrator/SKILLS/nixery',
          kind: 'skills',
          pluginId: 'fixture',
          srcAbs: skillSrc,
          srcRel: 'server/nixery/fixture/SKILLS/nixery',
        },
        {
          basename: 'nixery.md',
          containerDest: '/opt/yahl/nixery.md',
          destAbs: path.join(repoRoot, 'runtime', 'orchestrator', 'YAHL', 'nixery.md'),
          destRel: 'runtime/orchestrator/YAHL/nixery.md',
          kind: 'prompts',
          pluginId: 'fixture',
          srcAbs: promptSrc,
          srcRel: 'server/nixery/fixture/prompts/nixery.md',
        },
        {
          basename: 'knowledge-persist.md',
          containerDest: '/opt/yahl/knowledge-persist.md',
          destAbs: path.join(repoRoot, 'runtime', 'orchestrator', 'YAHL', 'knowledge-persist.md'),
          destRel: 'runtime/orchestrator/YAHL/knowledge-persist.md',
          kind: 'prompts',
          pluginId: 'fixture',
          srcAbs: persistSrc,
          srcRel: 'server/nixery/fixture/prompts/knowledge-persist.md',
        },
      ],
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
    assert.match(
      content,
      new RegExp(
        `${path.join(repoRoot, 'runtime', 'orchestrator', 'YAHL').replaceAll('/', '[/\\\\]')}`
        + ':/opt/yahl:ro',
      ),
    );
    assert.match(content, /\/opt\/skills\/nixery:ro/);
    assert.match(content, /\/opt\/yahl\/nixery\.md:ro/);
    assert.match(content, /\/opt\/yahl\/knowledge-persist\.md:ro/);
  });
});
