import fs from 'node:fs/promises';
import path from 'node:path';

import {
  listManagerTopicRows,
  readInstructionFile,
} from '/opt/nixery/knowledge-wiki/index.js';
import { logProgress, resolveDefId } from '../_shared/run-agent.mjs';

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

  logProgress(defId, 'start');

  try {
    const instruction = await readInstructionFile();
    const rows = await listManagerTopicRows(instruction);
    const topics = rows.map((row) => row.topic);
    const gate = {
      ok: true,
      instructionPreview: instruction.slice(0, 240),
      topics,
      rows,
    };

    await fs.writeFile(outputPath, `${JSON.stringify(gate, null, 2)}\n`, 'utf8');
    logProgress(defId, `done ok=true topicCount=${topics.length}`);
  } catch (error) {
    const gate = {
      ok: false,
      error: error instanceof Error ? error.message : 'list-manager-topics failed',
    };

    await fs.writeFile(outputPath, `${JSON.stringify(gate, null, 2)}\n`, 'utf8');
    logProgress(defId, `done ok=false error=${gate.error}`);
    process.exit(1);
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
