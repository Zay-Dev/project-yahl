import assert from 'node:assert/strict';
import path from 'node:path';
import { afterEach, describe, it } from 'node:test';

import { resolveMounts } from './resolve-mounts';

const hostRepoRoot = '/host/project-yahl';

describe('resolveMounts', () => {
  const previousHostRepoRoot = process.env.HOST_REPO_ROOT;

  afterEach(() => {
    if (previousHostRepoRoot === undefined) {
      delete process.env.HOST_REPO_ROOT;
    } else {
      process.env.HOST_REPO_ROOT = previousHostRepoRoot;
    }
  });

  it('maps mount tokens to docker host paths when HOST_REPO_ROOT is set', () => {
    process.env.HOST_REPO_ROOT = hostRepoRoot;

    const mounts = resolveMounts({
      def: {
        id: 'get-knowledge',
        packages: ['shell'],
        mount: {
          '/data/knowledge_export': { host: 'data/knowledge_export', mode: 'ro' },
          '/workspace': { host: 'session', mode: 'rw' },
          '/opt/nixery/def': { host: 'def', mode: 'ro' },
        },
      },
      defId: 'get-knowledge',
      sessionId: 'session-1',
    });

    assert.deepEqual(mounts, [
      {
        containerPath: '/data/knowledge_export',
        hostPath: path.join(hostRepoRoot, 'data/knowledge_export'),
        mode: 'ro',
      },
      {
        containerPath: '/workspace',
        hostPath: path.join(hostRepoRoot, 'data/workspace/sessions/session-1/nixery/get-knowledge'),
        mode: 'rw',
      },
      {
        containerPath: '/opt/nixery/def',
        hostPath: path.join(hostRepoRoot, 'server/nixery/get-knowledge'),
        mode: 'ro',
      },
    ]);
  });

  it('maps lib mount token to nixery _lib dist path', () => {
    process.env.HOST_REPO_ROOT = hostRepoRoot;

    const mounts = resolveMounts({
      def: {
        id: 'write-def-fixture',
        packages: ['nodejs'],
        mount: {
          '/opt/nixery/knowledge-wiki': { host: 'lib/knowledge-wiki', mode: 'ro' },
        },
      },
      defId: 'write-def-fixture',
      sessionId: 'session-1',
    });

    assert.deepEqual(mounts, [
      {
        containerPath: '/opt/nixery/knowledge-wiki',
        hostPath: path.join(hostRepoRoot, 'server/nixery/_lib/knowledge-wiki/dist'),
        mode: 'ro',
      },
    ]);
  });

  it('maps session-root mount token to session workspace root', () => {
    process.env.HOST_REPO_ROOT = hostRepoRoot;

    const mounts = resolveMounts({
      def: {
        id: 'research',
        packages: ['nodejs'],
        mount: {
          '/session': { host: 'session-root', mode: 'rw' },
        },
      },
      defId: 'research',
      sessionId: 'session-1',
    });

    assert.deepEqual(mounts, [
      {
        containerPath: '/session',
        hostPath: path.join(hostRepoRoot, 'data/workspace/sessions/session-1'),
        mode: 'rw',
      },
    ]);
  });

  it('allows data/whatsapp_inbox mounts', () => {
    process.env.HOST_REPO_ROOT = hostRepoRoot;

    const mounts = resolveMounts({
      def: {
        id: 'whatsapp-inbox',
        packages: ['nodejs'],
        mount: {
          '/whatsapp/inbox': { host: 'data/whatsapp_inbox', mode: 'rw' },
        },
      },
      defId: 'whatsapp-inbox',
      sessionId: 'session-1',
    });

    assert.deepEqual(mounts, [
      {
        containerPath: '/whatsapp/inbox',
        hostPath: path.join(hostRepoRoot, 'data/whatsapp_inbox'),
        mode: 'rw',
      },
    ]);
  });
});
