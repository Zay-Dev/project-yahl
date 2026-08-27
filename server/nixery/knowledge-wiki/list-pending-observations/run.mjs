import fs from 'node:fs/promises';
import path from 'node:path';

import { buildTopicIntake } from '/opt/nixery/plugin/lib/dist/index.js';
import { logProgress, resolveDefId } from '../lib/run-agent.mjs';

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
  const topic = typeof input.topic === 'string' ? input.topic.trim() : '';
  const instruction = typeof input.instruction === 'string' ? input.instruction : '';

  if (!topic) {
    const gate = { ok: false, error: 'topic is required' };

    await fs.writeFile(outputPath, `${JSON.stringify(gate, null, 2)}\n`, 'utf8');
    process.exit(1);
  }

  logProgress(defId, `start topic=${topic}`);

  try {
    const intake = await buildTopicIntake({ instruction, topic });
    const gate = {
      ok: true,
      intake,
      needsValidation: intake.needsValidation,
      observationCount: intake.observations.length,
      topic: intake.topic,
    };

    await fs.writeFile(outputPath, `${JSON.stringify(gate, null, 2)}\n`, 'utf8');
    logProgress(defId, `done ok=true observations=${intake.observations.length} needsValidation=${intake.needsValidation.length}`);
  } catch (error) {
    const gate = {
      ok: false,
      error: error instanceof Error ? error.message : 'list-pending-observations failed',
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
