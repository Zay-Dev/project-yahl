import assert from 'node:assert/strict';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';

import { echoTaskSkillsToSession, ensureTaskDataSymlink, ensureTaskWorkspace, removeSessionWorkspace, taskWorkspaceRoot } from './workspace-paths';

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

describe('ensureTaskDataSymlink', () => {
  let workspaceRoot = '';
  let previousWorkspaceRoot: string | undefined;

  after(async () => {
    process.env.WORKSPACE_ROOT = previousWorkspaceRoot;

    if (workspaceRoot) {
      await rm(workspaceRoot, { force: true, recursive: true });
    }
  });

  it('creates a relative symlink to the task workspace', async () => {
    previousWorkspaceRoot = process.env.WORKSPACE_ROOT;
    workspaceRoot = await mkdtemp(path.join(tmpdir(), 'yahl-task-data-link-'));
    process.env.WORKSPACE_ROOT = workspaceRoot;

    const sessionId = 'sess-symlink';
    const taskId = 'hk_weather';

    await mkdir(path.join(workspaceRoot, 'sessions', sessionId), { recursive: true });

    const result = await ensureTaskDataSymlink(sessionId, taskId);

    assert.equal(result.created, true);
    assert.equal(
      result.path,
      path.join(workspaceRoot, 'sessions', sessionId, 'data'),
    );
    assert.equal(taskWorkspaceRoot(taskId), path.join(workspaceRoot, 'tasks', taskId));
  });
});

describe('removeSessionWorkspace orchestrator wrapper', () => {
  let workspaceRoot = '';
  let previousWorkspaceRoot: string | undefined;

  after(async () => {
    process.env.WORKSPACE_ROOT = previousWorkspaceRoot;

    if (workspaceRoot) {
      await rm(workspaceRoot, { force: true, recursive: true });
    }
  });

  it('removes session workspace but preserves task data symlink target', async () => {
    previousWorkspaceRoot = process.env.WORKSPACE_ROOT;
    workspaceRoot = await mkdtemp(path.join(tmpdir(), 'yahl-remove-data-link-'));
    process.env.WORKSPACE_ROOT = workspaceRoot;

    const sessionId = 'sess-data-link';
    const taskId = 'hk_weather';

    await ensureTaskWorkspace(taskId);
    await mkdir(path.join(workspaceRoot, 'sessions', sessionId), { recursive: true });
    await ensureTaskDataSymlink(sessionId, taskId);
    await writeFile(path.join(workspaceRoot, 'tasks', taskId, 'hk_observatory_api.md'), '# api', 'utf8');
    await mkdir(path.join(workspaceRoot, 'sessions', sessionId, 'plans'), { recursive: true });

    const result = await removeSessionWorkspace(sessionId);

    assert.equal(result.removed, true);
    await access(path.join(workspaceRoot, 'tasks', taskId, 'hk_observatory_api.md'));
    await assert.rejects(() => access(path.join(workspaceRoot, 'sessions', sessionId)));
  });
});
