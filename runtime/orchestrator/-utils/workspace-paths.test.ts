import assert from 'node:assert/strict';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';

import { echoTaskSkillsToSession } from './workspace-paths';

describe('echoTaskSkillsToSession', () => {
  let workspaceRoot = '';
  let previousWorkspaceRoot: string | undefined;

  after(async () => {
    process.env.WORKSPACE_ROOT = previousWorkspaceRoot;

    if (workspaceRoot) {
      await rm(workspaceRoot, { force: true, recursive: true });
    }
  });

  it('writes session task-skills from snapshot files', async () => {
    previousWorkspaceRoot = process.env.WORKSPACE_ROOT;
    workspaceRoot = await mkdtemp(path.join(tmpdir(), 'yahl-echo-skills-'));
    process.env.WORKSPACE_ROOT = workspaceRoot;

    const sessionId = 'sess-echo';
    const files = [
      { content: '# mission v1', path: 'task-mission/SKILL.md' },
      { content: '# helper', path: 'helper/SKILL.md' },
    ];

    const result = await echoTaskSkillsToSession(sessionId, files);

    assert.equal(result.echoed, true);
    assert.equal(result.fileCount, 2);

    const mission = await readFile(
      path.join(workspaceRoot, 'sessions', sessionId, 'task-skills', 'task-mission', 'SKILL.md'),
      'utf8',
    );

    assert.equal(mission, '# mission v1');
  });

  it('returns echoed false when file list is empty', async () => {
    previousWorkspaceRoot = process.env.WORKSPACE_ROOT;
    workspaceRoot = await mkdtemp(path.join(tmpdir(), 'yahl-echo-empty-'));
    process.env.WORKSPACE_ROOT = workspaceRoot;

    const result = await echoTaskSkillsToSession('sess-empty', []);

    assert.equal(result.echoed, false);
    assert.equal(result.fileCount, 0);
  });
});
