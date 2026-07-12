import assert from 'node:assert/strict';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';

import {
  copySessionWorkspace,
  removeSessionWorkspace,
} from '@project-yahl/shared/yahl/workspace-paths';

describe('sessions workspace-paths re-exports', () => {
  let workspaceRoot = '';
  let previousWorkspaceRoot: string | undefined;

  after(async () => {
    delete process.env.WORKSPACE_ROOT;
    process.env.WORKSPACE_ROOT = previousWorkspaceRoot;

    if (workspaceRoot) {
      await rm(workspaceRoot, { force: true, recursive: true });
    }
  });

  it('re-exports copySessionWorkspace with sessions log tag', async () => {
    previousWorkspaceRoot = process.env.WORKSPACE_ROOT;
    workspaceRoot = await mkdtemp(path.join(tmpdir(), 'yahl-server-reexport-'));
    process.env.WORKSPACE_ROOT = workspaceRoot;

    const { copySessionWorkspace: copyFromServer } = await import('./-workspace-paths');

    const sourceSessionId = 'source-session';
    const targetSessionId = 'target-session';

    await mkdir(path.join(workspaceRoot, 'sessions', sourceSessionId), { recursive: true });
    await writeFile(
      path.join(workspaceRoot, 'sessions', sourceSessionId, 'scratch.txt'),
      'session only',
      'utf8',
    );

    const result = await copyFromServer(sourceSessionId, targetSessionId);

    assert.equal(result.copied, true);
    assert.equal(
      await readFile(path.join(result.path, 'scratch.txt'), 'utf8'),
      'session only',
    );
    assert.equal(typeof copySessionWorkspace, 'function');
    assert.equal(typeof removeSessionWorkspace, 'function');
    await access(path.join(result.path, 'scratch.txt'));
  });
});
