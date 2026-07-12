import type { TNixeryDef, TNixeryMountSpec } from '@project-yahl/shared/nixery/types';

import path from 'node:path';

import {
  resolveDockerHostRepoRoot,
  resolveDockerHostWorkspacePath,
} from '@/orchestrator/-docker/paths';

const resolveDockerHostSessionNixeryDir = (sessionId: string, defId: string) =>
  path.join(resolveDockerHostWorkspacePath(), 'sessions', sessionId, 'nixery', defId);

const allowedDockerHostPrefixes = () => [
  resolveDockerHostWorkspacePath(),
  path.join(resolveDockerHostRepoRoot(), 'data', 'knowledge_export'),
  path.join(resolveDockerHostRepoRoot(), 'server', 'nixery'),
];

const isAllowedPath = (resolved: string, prefixes: string[]) =>
  prefixes.some((prefix) =>
    resolved === prefix || resolved.startsWith(`${prefix}${path.sep}`));

const resolveMountHost = (params: {
  defId: string;
  host: string;
  sessionId: string;
}) => {
  const token = params.host.trim();

  if (token === 'session') {
    return resolveDockerHostSessionNixeryDir(params.sessionId, params.defId);
  }

  if (token === 'def') {
    return path.join(resolveDockerHostRepoRoot(), 'server', 'nixery', params.defId);
  }

  if (token.startsWith('data/')) {
    return path.join(resolveDockerHostRepoRoot(), token);
  }

  throw new Error(`[nixery] unsupported mount host token: ${params.host}`);
};

export const resolveMounts = (params: {
  def: TNixeryDef;
  defId: string;
  sessionId: string;
}) => {
  const mounts = params.def.mount ?? {};
  const volumeMounts: { containerPath: string; hostPath: string; mode: 'ro' | 'rw' }[] = [];

  for (const [containerPath, spec] of Object.entries(mounts)) {
    const mountSpec = spec as TNixeryMountSpec;
    const hostPath = resolveMountHost({
      defId: params.defId,
      host: mountSpec.host,
      sessionId: params.sessionId,
    });

    if (!isAllowedPath(hostPath, allowedDockerHostPrefixes())) {
      throw new Error(`[nixery] mount host path not allowed: ${hostPath}`);
    }

    volumeMounts.push({
      containerPath,
      hostPath,
      mode: mountSpec.mode,
    });
  }

  return volumeMounts;
};
