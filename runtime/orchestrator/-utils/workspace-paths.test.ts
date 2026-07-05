import assert from 'node:assert/strict';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';

import { echoTaskSkillsToSession, removeSessionWorkspace } from './workspace-paths';

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

describe('removeSessionWorkspace', () => {
  let workspaceRoot = '';
  let previousWorkspaceRoot: string | undefined;

  after(async () => {
    process.env.WORKSPACE_ROOT = previousWorkspaceRoot;

    if (workspaceRoot) {
      await rm(workspaceRoot, { force: true, recursive: true });
    }
  });

  it('removes the session workspace tree', async () => {
    previousWorkspaceRoot = process.env.WORKSPACE_ROOT;
    workspaceRoot = await mkdtemp(path.join(tmpdir(), 'yahl-remove-ws-'));
    process.env.WORKSPACE_ROOT = workspaceRoot;

    const sessionId = 'sess-remove';
    const sessionRoot = path.join(workspaceRoot, 'sessions', sessionId);

    await mkdir(path.join(sessionRoot, 'plans'), { recursive: true });
    await writeFile(path.join(sessionRoot, 'plans', 'req-1.md'), '# plan', 'utf8');

    const result = await removeSessionWorkspace(sessionId);

    assert.equal(result.removed, true);
    assert.equal(result.path, sessionRoot);
    await assert.rejects(() => access(sessionRoot));
  });

  it('rejects unsafe session ids', async () => {
    previousWorkspaceRoot = process.env.WORKSPACE_ROOT;
    workspaceRoot = await mkdtemp(path.join(tmpdir(), 'yahl-remove-unsafe-'));
    process.env.WORKSPACE_ROOT = workspaceRoot;

    const result = await removeSessionWorkspace('../escape');

    assert.equal(result.removed, false);
  });
});
