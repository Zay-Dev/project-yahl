import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import {
  clearStaleNixeryOutput,
  validateNixeryOutputFile,
} from '@/orchestrator/-nixery/validate-output';
import { resolveNixeryContainerName } from '@/orchestrator/-nixery/run-container';
import { buildNixeryValidationContext } from '@/orchestrator/-nixery/run-validation-container';
import { resolveDockerHostSessionDir } from '@/orchestrator/-nixery/resolve-mounts';

describe('resolveNixeryContainerName', () => {
  it('builds stable docker-safe name from session and def', () => {
    const name = resolveNixeryContainerName('85053f4a-9f9c-48a0-bd97-398ed61380b3', 'list-knowledge-pages');

    assert.equal(name.length, 63);
    assert.match(name, /^nixery-85053f4a-9f9c-48a0-bd97-398ed61380b3-list-knowledge/);
  });
});

describe('buildNixeryValidationContext', () => {
  it('uses container workspace paths', () => {
    assert.deepEqual(buildNixeryValidationContext({
      defId: 'get-knowledge',
      input: { output: 'identity.md' },
      outputName: 'identity.md',
    }), {
      defId: 'get-knowledge',
      input: { output: 'identity.md' },
      outputPath: '/workspace/identity.md',
      workspace: '/workspace',
    });
  });
});

describe('resolveDockerHostSessionDir', () => {
  it('rewrites orchestrator workspace path to docker host workspace path', () => {
    const prevHostRoot = process.env.HOST_REPO_ROOT;
    const prevWorkspaceRoot = process.env.WORKSPACE_ROOT;

    process.env.HOST_REPO_ROOT = '/host/project-yahl';
    process.env.WORKSPACE_ROOT = '/workspace';

    try {
      assert.equal(
        resolveDockerHostSessionDir('/workspace/sessions/abc/nixery/get-knowledge'),
        path.join('/host/project-yahl', 'data', 'workspace', 'sessions', 'abc', 'nixery', 'get-knowledge'),
      );
    } finally {
      if (prevHostRoot === undefined) {
        delete process.env.HOST_REPO_ROOT;
      } else {
        process.env.HOST_REPO_ROOT = prevHostRoot;
      }

      if (prevWorkspaceRoot === undefined) {
        delete process.env.WORKSPACE_ROOT;
      } else {
        process.env.WORKSPACE_ROOT = prevWorkspaceRoot;
      }
    }
  });
});

describe('validateNixeryOutputFile', () => {
  it('returns not ok when output file is missing', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'nixery-output-'));

    assert.deepEqual(await validateNixeryOutputFile({
      defId: 'get-knowledge',
      input: { output: 'identity.md' },
      outputName: 'identity.md',
      sessionDir: dir,
    }), { ok: false, reason: 'output file missing' });

    await fs.rm(dir, { recursive: true, force: true });
  });
});

describe('clearStaleNixeryOutput', () => {
  it('unlinks a prior result.json so wait cannot accept a stale gate', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'nixery-stale-'));
    const outputPath = path.join(dir, 'result.json');

    await fs.writeFile(outputPath, `${JSON.stringify({ ok: true, review: { topic: 'prior' } }, null, 2)}\n`);

    const name = await clearStaleNixeryOutput({
      outputHint: 'result.json',
      sessionDir: dir,
    });

    assert.equal(name, 'result.json');
    assert.deepEqual(await validateNixeryOutputFile({
      defId: 'apply-manager-topic',
      input: { output: 'result.json' },
      outputName: 'result.json',
      sessionDir: dir,
    }), { ok: false, reason: 'output file missing' });

    await fs.rm(dir, { recursive: true, force: true });
  });

  it('ignores missing output files', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'nixery-stale-missing-'));

    await clearStaleNixeryOutput({
      outputHint: 'apply-traffic-monitor.json',
      sessionDir: dir,
    });

    await fs.rm(dir, { recursive: true, force: true });
  });
});
