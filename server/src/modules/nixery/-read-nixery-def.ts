import fs from 'fs/promises';
import path from 'path';

import { loadNixeryDefFromFile } from '@project-yahl/shared/nixery/load-def';

import { nixeryIndexAbsolutePath, nixeryIndexRelativePath, resolveNixeryRoot } from './-nixery-root';

export const readNixeryDef = async (defId: string) => {
  const absolutePath = nixeryIndexAbsolutePath(defId);
  const def = await loadNixeryDefFromFile(absolutePath);

  if (def.id !== defId) {
    throw new Error(`nixery def id mismatch: folder ${defId} vs index id ${def.id}`);
  }

  return {
    def,
    id: defId,
    path: nixeryIndexRelativePath(defId),
  };
};

export const listNixeryDefIds = async () => {
  const root = resolveNixeryRoot();
  const entries = await fs.readdir(root, { withFileTypes: true });
  const ids: string[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('_')) {
      continue;
    }

    const indexPath = path.join(root, entry.name, 'index.yml');

    try {
      await fs.access(indexPath);
      ids.push(entry.name);
    } catch {
      continue;
    }
  }

  ids.sort((left, right) => left.localeCompare(right));

  return ids;
};
