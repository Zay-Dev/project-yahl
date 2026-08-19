import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, it } from 'node:test';

import { resolveRepoRootForEnv } from './config';

describe('resolveRepoRootForEnv', () => {
  const keys = ['HOST_REPO_ROOT', 'RUNTIME_REPO_ROOT'] as const;

  const originals = Object.fromEntries(
    keys.map((key) => [key, process.env[key]]),
  );

  const tempRoots: string[] = [];

  afterEach(() => {
    for (const key of keys) {
      const original = originals[key];

      if (original === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = original;
      }
    }

    for (const root of tempRoots.splice(0)) {
      fs.rmSync(root, { force: true, recursive: true });
    }
  });

  const makeTempRoot = () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'yahl-env-root-'));

    tempRoots.push(root);

    return root;
  };

  it('prefers RUNTIME_REPO_ROOT parent when it has env files and HOST_REPO_ROOT does not', () => {
    const readable = makeTempRoot();
    const runtimeDir = path.join(readable, 'runtime');
    const hostOnly = makeTempRoot();
    const moduleDir = path.join(makeTempRoot(), 'runtime', 'orchestrator');

    fs.mkdirSync(runtimeDir, { recursive: true });
    fs.mkdirSync(moduleDir, { recursive: true });
    fs.writeFileSync(path.join(readable, '.env.nixery'), 'OPENAI_BASE_URL=https://example.test\n');

    process.env.HOST_REPO_ROOT = hostOnly;
    process.env.RUNTIME_REPO_ROOT = runtimeDir;

    assert.equal(
      resolveRepoRootForEnv({ moduleDir }),
      path.resolve(readable),
    );
  });

  it('falls back to module-relative root when RUNTIME_REPO_ROOT has no env files', () => {
    const moduleRepo = makeTempRoot();
    const moduleDir = path.join(moduleRepo, 'runtime', 'orchestrator');
    const runtimeWithoutEnv = path.join(makeTempRoot(), 'runtime');
    const hostOnly = makeTempRoot();

    fs.mkdirSync(moduleDir, { recursive: true });
    fs.mkdirSync(runtimeWithoutEnv, { recursive: true });
    fs.writeFileSync(path.join(moduleRepo, '.env'), 'LLM_BASE_URL=https://example.test\n');

    process.env.HOST_REPO_ROOT = hostOnly;
    process.env.RUNTIME_REPO_ROOT = runtimeWithoutEnv;

    assert.equal(
      resolveRepoRootForEnv({ moduleDir }),
      path.resolve(moduleRepo),
    );
  });

  it('uses HOST_REPO_ROOT when neither RUNTIME nor module-relative have env files', () => {
    const hostRoot = makeTempRoot();
    const moduleDir = path.join(makeTempRoot(), 'runtime', 'orchestrator');
    const runtimeWithoutEnv = path.join(makeTempRoot(), 'runtime');

    fs.mkdirSync(moduleDir, { recursive: true });
    fs.mkdirSync(runtimeWithoutEnv, { recursive: true });
    fs.writeFileSync(path.join(hostRoot, '.env.nixery'), 'OPENAI_BASE_URL=https://example.test\n');

    process.env.HOST_REPO_ROOT = hostRoot;
    process.env.RUNTIME_REPO_ROOT = runtimeWithoutEnv;

    assert.equal(
      resolveRepoRootForEnv({ moduleDir }),
      path.resolve(hostRoot),
    );
  });
});
