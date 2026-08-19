import { loadNixeryDefFromFile } from '@project-yahl/shared/nixery/load-def';
import { listNixeryDefIds as listSharedNixeryDefIds } from '@project-yahl/shared/nixery/list-defs';

import {
  nixeryIndexAbsolutePath,
  nixeryIndexRelativePath,
  resolveNixeryRoot,
} from './-nixery-root';

export const readNixeryDef = async (defId: string) => {
  const absolutePath = await nixeryIndexAbsolutePath(defId);
  const def = await loadNixeryDefFromFile(absolutePath);

  if (def.id !== defId) {
    throw new Error(`nixery def id mismatch: folder ${defId} vs index id ${def.id}`);
  }

  return {
    def,
    id: defId,
    path: await nixeryIndexRelativePath(defId),
  };
};

export const listNixeryDefIds = async () => listSharedNixeryDefIds(resolveNixeryRoot());
