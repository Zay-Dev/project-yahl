import fs from 'node:fs/promises';
import path from 'node:path';

import { logProgress, resolveDefId } from '../lib/run-agent.mjs';
import { submitKnowledgeObservation } from '../lib/submit-observation.mjs';

const readJson = async (filePath) => {
  const raw = await fs.readFile(filePath, 'utf8');

  return JSON.parse(raw);
};

const main = async () => {
  const workspace = '/workspace';
  const defRoot = '/opt/nixery/def';
  const defId = resolveDefId(defRoot);
  const input = await readJson(path.join(workspace, 'input.json'));
  const outputName = typeof input.output === 'string' && input.output.trim()
    ? input.output.trim()
    : 'result.json';
  const outputPath = path.join(workspace, outputName);

  const { gate, observation, result } = await submitKnowledgeObservation({ input });

  await fs.writeFile(outputPath, `${JSON.stringify(gate, null, 2)}\n`, 'utf8');
  await fs.writeFile(
    path.join(workspace, 'observation-detail.json'),
    `${JSON.stringify({ observation, result }, null, 2)}\n`,
    'utf8',
  );

  if (gate.ok) {
    logProgress(defId, `submit topic=${gate.topic} path=${gate.path}`);
  }

  if (!gate.ok) {
    process.exit(1);
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
