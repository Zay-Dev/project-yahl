import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ensureNixeryPluginLinks } from '../dist/nixery/ensure-plugin-links.js';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(moduleDir, '../..');
const nixeryRoot = path.join(repoRoot, 'server', 'nixery');

const installs = await ensureNixeryPluginLinks({ nixeryRoot, repoRoot });

for (const install of installs) {
  console.log(`${install.kind}\t${install.pluginId}\t${install.destRel} -> ${install.srcRel}`);
}

console.log(`linked ${installs.length} nixery plugin artifact(s)`);
