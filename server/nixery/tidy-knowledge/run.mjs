import fs from 'node:fs/promises';
import path from 'node:path';

import { runTidyKnowledge } from '/opt/nixery/knowledge-wiki/tidy-knowledge.js';
import { logProgress, resolveDefId } from '../_shared/run-agent.mjs';

const readJson = async (filePath) => {
  const raw = await fs.readFile(filePath, 'utf8');

  return JSON.parse(raw);
};

const parseDryRun = (value) => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim().toLowerCase();

    if (trimmed === 'false' || trimmed === '0') {
      return false;
    }

    if (trimmed === 'true' || trimmed === '1') {
      return true;
    }
  }

  return undefined;
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
  const topic = typeof input.topic === 'string' ? input.topic.trim() : undefined;
  const dryRun = parseDryRun(input.dryRun);

  logProgress(defId, `start topic=${topic ?? '*'} dryRun=${dryRun ?? 'default'}`);

  try {
    const report = await runTidyKnowledge({
      dryRun,
      topic,
    });

    const gate = {
      ok: true,
      report,
    };

    await fs.writeFile(outputPath, `${JSON.stringify(gate, null, 2)}\n`, 'utf8');
    logProgress(defId, `done ok=true topicCount=${report.topicCount}`);
  } catch (error) {
    const gate = {
      ok: false,
      error: error instanceof Error ? error.message : 'tidy-knowledge failed',
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
