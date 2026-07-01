import assert from 'node:assert/strict';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';

import Joi from 'joi';

import { removeSessionWorkspace } from '../-workspace-paths';

const querySchema = Joi.object({
  mode: Joi.string().valid('soft', 'hard').required(),
});

describe('deleteSession query', () => {
  it('accepts soft and hard mode', () => {
    assert.equal(querySchema.validate({ mode: 'soft' }).error, undefined);
    assert.equal(querySchema.validate({ mode: 'hard' }).error, undefined);
  });

  it('rejects missing or invalid mode', () => {
    assert.ok(querySchema.validate({}).error);
    assert.ok(querySchema.validate({ mode: 'archive' }).error);
  });
});

describe('hard delete session workspace cleanup', () => {
  let workspaceRoot = '';
  let previousWorkspaceRoot: string | undefined;

  after(async () => {
    process.env.WORKSPACE_ROOT = previousWorkspaceRoot;

    if (workspaceRoot) {
      await rm(workspaceRoot, { force: true, recursive: true });
    }
  });

  it('removeSessionWorkspace deletes the session folder used by hard delete', async () => {
    previousWorkspaceRoot = process.env.WORKSPACE_ROOT;
    workspaceRoot = await mkdtemp(path.join(tmpdir(), 'yahl-hard-delete-ws-'));
    process.env.WORKSPACE_ROOT = workspaceRoot;

    const sessionId = 'sess-hard-delete';
    const sessionRoot = path.join(workspaceRoot, 'sessions', sessionId);

    await mkdir(path.join(sessionRoot, 'plans'), { recursive: true });
    await writeFile(path.join(sessionRoot, 'plans', 'req-1.md'), '# plan', 'utf8');

    const result = await removeSessionWorkspace(sessionId);

    assert.equal(result.removed, true);
    assert.equal(result.path, sessionRoot);
    await assert.rejects(() => access(sessionRoot));
  });
});
