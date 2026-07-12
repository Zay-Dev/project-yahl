import fs from 'fs';
import path from 'path';

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

export const nixeryIndexRelativePath = (defId: string) =>
  `server/nixery/${defId}/index.yml`;

export const nixeryIndexAbsolutePath = (defId: string) =>
  path.join(resolveNixeryRoot(), defId, 'index.yml');
