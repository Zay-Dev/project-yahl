import path from 'path';

import { resolveNixeryAbilityLocation } from '@project-yahl/shared/nixery/list-defs';

import fs from 'fs';

const _findProjectYahlRoot = (startDir: string) => {
  let current = path.resolve(startDir);

  for (let depth = 0; depth < 10; depth += 1) {
    const runtimePkg = path.join(current, 'runtime', 'package.json');

    if (fs.existsSync(runtimePkg)) {
      return current;
    }

    const parent = path.dirname(current);

    if (parent === current) {
      break;
    }

    current = parent;
  }

  return startDir;
};

export const resolveNixeryRoot = () =>
  path.join(_findProjectYahlRoot(process.cwd()), 'server', 'nixery');

export const nixeryIndexRelativePath = async (defId: string) => {
  const location = await resolveNixeryAbilityLocation(resolveNixeryRoot(), defId);

  return `server/nixery/${location.pluginId}/${location.abilityId}/index.yml`;
};

export const nixeryIndexAbsolutePath = async (defId: string) => {
  const location = await resolveNixeryAbilityLocation(resolveNixeryRoot(), defId);

  return location.indexPath;
};
