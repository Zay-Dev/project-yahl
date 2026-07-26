import path from 'node:path';

import { loadNixeryDefFromFile } from '@project-yahl/shared/nixery/load-def';

import { repoRoot } from '@/orchestrator/-docker/paths';

export const resolveNixeryRoot = () => path.join(repoRoot, 'server', 'nixery');

export const resolveNixeryDefPath = (defId: string) =>
  path.join(resolveNixeryRoot(), defId, 'index.yml');

export const loadNixeryDef = async (defId: string) => {
  const filePath = resolveNixeryDefPath(defId);
  const def = await loadNixeryDefFromFile(filePath);

  if (def.id !== defId) {
    throw new Error(`nixery def id mismatch: folder ${defId} vs index id ${def.id}`);
  }

  return def;
};
