import { loadNixeryDefFromFile } from '@project-yahl/shared/nixery/load-def';
import { resolveNixeryAbilityLocation } from '@project-yahl/shared/nixery/list-defs';

import path from 'node:path';

import { repoRoot } from '@/orchestrator/-docker/paths';

import type { TNixeryAbilityLocation, TNixeryDef } from '@project-yahl/shared/nixery/types';

export const resolveNixeryRoot = () => path.join(repoRoot, 'server', 'nixery');

export const resolveNixeryAbility = async (defId: string): Promise<TNixeryAbilityLocation> =>
  resolveNixeryAbilityLocation(resolveNixeryRoot(), defId);

export const resolveNixeryDefPath = async (defId: string) => {
  const location = await resolveNixeryAbility(defId);

  return location.indexPath;
};

export const loadNixeryDef = async (defId: string): Promise<{
  def: TNixeryDef;
  location: TNixeryAbilityLocation;
}> => {
  const location = await resolveNixeryAbility(defId);
  const def = await loadNixeryDefFromFile(location.indexPath);

  if (def.id !== defId) {
    throw new Error(
      `nixery def id mismatch: folder ${defId} vs index id ${def.id} (plugin ${location.pluginId})`,
    );
  }

  return { def, location };
};
