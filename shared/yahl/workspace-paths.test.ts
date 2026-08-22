import assert from 'node:assert/strict';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';

import {
  copySessionWorkspace,
  ensureTaskWorkspace,
  removeSessionWorkspace,
  SESSION_TASK_DATA_DIR,
  taskScriptsDir,
} from './workspace-paths';

describe('ensureTaskWorkspace', () => {
  let workspaceRoot = '';
  let previousWorkspaceRoot: string | undefined;

  after(async () => {
    process.env.WORKSPACE_ROOT = previousWorkspaceRoot;

    if (workspaceRoot) {
      await rm(workspaceRoot, { force: true, recursive: true });
    }
  });

  it('creates task root and scripts directory', async () => {
    previousWorkspaceRoot = process.env.WORKSPACE_ROOT;
    workspaceRoot = await mkdtemp(path.join(tmpdir(), 'yahl-task-ws-'));
    process.env.WORKSPACE_ROOT = workspaceRoot;

    const taskId = 'traffic_monitor';

    await ensureTaskWorkspace(taskId);
    await access(taskScriptsDir(taskId));
  });
});

describe('copySessionWorkspace', () => {
  let workspaceRoot = '';
  let previousWorkspaceRoot: string | undefined;

  after(async () => {
    delete process.env.WORKSPACE_ROOT;
    process.env.WORKSPACE_ROOT = previousWorkspaceRoot;

    if (workspaceRoot) {
      await rm(workspaceRoot, { force: true, recursive: true });
    }
  });

  it('skips shared task data directory when forking workspace', async () => {
    previousWorkspaceRoot = process.env.WORKSPACE_ROOT;
    workspaceRoot = await mkdtemp(path.join(tmpdir(), 'yahl-copy-ws-'));
    process.env.WORKSPACE_ROOT = workspaceRoot;

    const sourceSessionId = 'source-session';
    const targetSessionId = 'target-session';
    const taskId = 'hk_weather';

    await ensureTaskWorkspace(taskId);

    const sourceRoot = path.join(workspaceRoot, 'sessions', sourceSessionId);
    const taskDataRoot = path.join(workspaceRoot, 'tasks', taskId);

    await mkdir(path.join(sourceRoot, SESSION_TASK_DATA_DIR), { recursive: true });
    await writeFile(path.join(taskDataRoot, 'hk_observatory_api.md'), '# shared api', 'utf8');
    await writeFile(path.join(sourceRoot, SESSION_TASK_DATA_DIR, 'hk_observatory_api.md'), '# shared api', 'utf8');
    await writeFile(path.join(sourceRoot, 'scratch.txt'), 'session only', 'utf8');

    const result = await copySessionWorkspace(sourceSessionId, targetSessionId);

    assert.equal(result.copied, true);
    await access(path.join(result.path, 'scratch.txt'));
    await assert.rejects(() => access(path.join(result.path, SESSION_TASK_DATA_DIR)));
    await access(path.join(taskDataRoot, 'hk_observatory_api.md'));
    assert.equal(
      await readFile(path.join(taskDataRoot, 'hk_observatory_api.md'), 'utf8'),
      '# shared api',
    );
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

  it('removes session workspace but preserves non-empty task workspace', async () => {
    previousWorkspaceRoot = process.env.WORKSPACE_ROOT;
    workspaceRoot = await mkdtemp(path.join(tmpdir(), 'yahl-remove-data-dir-'));
    process.env.WORKSPACE_ROOT = workspaceRoot;

    const sessionId = 'sess-data-dir';
    const taskId = 'hk_weather';

    await ensureTaskWorkspace(taskId);
    await mkdir(path.join(workspaceRoot, 'sessions', sessionId, SESSION_TASK_DATA_DIR), { recursive: true });
    await writeFile(path.join(workspaceRoot, 'tasks', taskId, 'hk_observatory_api.md'), '# api', 'utf8');
    await mkdir(path.join(workspaceRoot, 'sessions', sessionId, 'plans'), { recursive: true });

    const result = await removeSessionWorkspace(sessionId);

    assert.equal(result.removed, true);
    await access(path.join(workspaceRoot, 'tasks', taskId, 'hk_observatory_api.md'));
    await assert.rejects(() => access(path.join(workspaceRoot, 'sessions', sessionId)));
  });
});

describe('ensureTaskWorkspace', () => {
  let workspaceRoot = '';
  let previousWorkspaceRoot: string | undefined;

  after(async () => {
    process.env.WORKSPACE_ROOT = previousWorkspaceRoot;

    if (workspaceRoot) {
      await rm(workspaceRoot, { force: true, recursive: true });
    }
  });

  it('rejects unsafe task ids', async () => {
    previousWorkspaceRoot = process.env.WORKSPACE_ROOT;
    workspaceRoot = await mkdtemp(path.join(tmpdir(), 'yahl-task-unsafe-'));
    process.env.WORKSPACE_ROOT = workspaceRoot;

    await assert.rejects(() => ensureTaskWorkspace('../escape'));
  });
});
