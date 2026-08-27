import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { prepareAgentFiles } from '../dist/agent-files/prepare-agent-files.js';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(moduleDir, '../..');

const { copied, layout } = await prepareAgentFiles({ repoRoot });

for (const entry of copied) {
  console.log(`${entry.kind}\t${entry.pluginId}\t${entry.basename}`);
}

console.log(
  `prepared agent files at ${path.relative(repoRoot, layout.agentFilesRoot)} `
  + `(${copied.length} nixery artifact(s))`,
);
