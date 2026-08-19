import assert from 'node:assert/strict';
import path from 'node:path';
import { afterEach, describe, it } from 'node:test';

import { resolveMounts } from './resolve-mounts';

import type { TNixeryAbilityLocation } from '@project-yahl/shared/nixery/types';

const hostRepoRoot = '/host/project-yahl';

const locationFor = (pluginId: string, abilityId: string): TNixeryAbilityLocation => ({
  abilityId,
  abilityDir: path.join(hostRepoRoot, 'server', 'nixery', pluginId, abilityId),
  indexPath: path.join(hostRepoRoot, 'server', 'nixery', pluginId, abilityId, 'index.yml'),
  pluginDir: path.join(hostRepoRoot, 'server', 'nixery', pluginId),
  pluginId,
});

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
      location: locationFor('knowledge-wiki', 'get-knowledge'),
      sessionId: 'session-1',
    });

    assert.deepEqual(mounts, [
      {
        containerPath: '/data/knowledge_export',
        hostPath: path.join(hostRepoRoot, 'data', 'knowledge_export'),
        mode: 'ro',
      },
      {
        containerPath: '/workspace',
        hostPath: path.join(hostRepoRoot, 'data/workspace/sessions/session-1/nixery/get-knowledge'),
        mode: 'rw',
      },
      {
        containerPath: '/opt/nixery/def',
        hostPath: path.join(hostRepoRoot, 'server', 'nixery', 'knowledge-wiki', 'get-knowledge'),
        mode: 'ro',
      },
      {
        containerPath: '/opt/nixery/plugin',
        hostPath: path.join(hostRepoRoot, 'server', 'nixery', 'knowledge-wiki'),
        mode: 'ro',
      },
    ]);
  });

  it('maps plugin mount token to plugin root', () => {
    process.env.HOST_REPO_ROOT = hostRepoRoot;

    const mounts = resolveMounts({
      def: {
        id: 'merge-topic',
        packages: ['nodejs'],
        mount: {
          '/opt/nixery/plugin': { host: 'plugin', mode: 'ro' },
        },
      },
      defId: 'merge-topic',
      location: locationFor('knowledge-wiki', 'merge-topic'),
      sessionId: 'session-1',
    });

    assert.deepEqual(mounts, [
      {
        containerPath: '/opt/nixery/plugin',
        hostPath: path.join(hostRepoRoot, 'server', 'nixery', 'knowledge-wiki'),
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
      location: locationFor('research', 'research'),
      sessionId: 'session-1',
    });

    assert.deepEqual(mounts, [
      {
        containerPath: '/session',
        hostPath: path.join(hostRepoRoot, 'data/workspace/sessions/session-1'),
        mode: 'rw',
      },
      {
        containerPath: '/opt/nixery/plugin',
        hostPath: path.join(hostRepoRoot, 'server', 'nixery', 'research'),
        mode: 'ro',
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
      location: locationFor('whatsapp', 'whatsapp-inbox'),
      sessionId: 'session-1',
    });

    assert.deepEqual(mounts, [
      {
        containerPath: '/whatsapp/inbox',
        hostPath: path.join(hostRepoRoot, 'data', 'whatsapp_inbox'),
        mode: 'rw',
      },
      {
        containerPath: '/opt/nixery/plugin',
        hostPath: path.join(hostRepoRoot, 'server', 'nixery', 'whatsapp'),
        mode: 'ro',
      },
    ]);
  });
});
