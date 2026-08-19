import fs from 'node:fs/promises';
import path from 'node:path';

import { mergeTopic } from '/opt/nixery/plugin/lib/dist/index.js';
import { logProgress, resolveDefId } from '../lib/run-agent.mjs';

const readJson = async (filePath) => {
  const raw = await fs.readFile(filePath, 'utf8');

  return JSON.parse(raw);
};

const parseBool = (value) => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim().toLowerCase();

  if (trimmed === 'true' || trimmed === '1') {
    return true;
  }

  if (trimmed === 'false' || trimmed === '0') {
    return false;
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
  const sourceTopic = typeof input.sourceTopic === 'string' ? input.sourceTopic.trim() : '';
  const targetTopic = typeof input.targetTopic === 'string' ? input.targetTopic.trim() : '';
  const dryRun = parseBool(input.dryRun) === true;

  if (!sourceTopic || !targetTopic) {
    const gate = { ok: false, error: 'sourceTopic and targetTopic are required' };

    await fs.writeFile(outputPath, `${JSON.stringify(gate, null, 2)}\n`, 'utf8');
    process.exit(1);
  }

  if (!process.env.SESSION_API_BASE_URL?.trim()) {
    process.env.SESSION_API_BASE_URL = 'http://server:4000';
  }

  logProgress(defId, `start source=${sourceTopic} target=${targetTopic} dryRun=${dryRun}`);

  try {
    const result = await mergeTopic({
      dryRun,
      sourceTopic,
      targetTopic,
    });
    const gate = {
      ok: true,
      aliased: result.aliased,
      pagesMerged: result.pagesMerged,
      pagesRetired: result.pagesRetired,
      sourceTopic: result.sourceTopic,
      targetTopic: result.targetTopic,
    };

    await fs.writeFile(outputPath, `${JSON.stringify(gate, null, 2)}\n`, 'utf8');
    logProgress(
      defId,
      `done ok=true aliased=${gate.aliased} retired=${gate.pagesRetired} merged=${gate.pagesMerged}`,
    );
  } catch (error) {
    const gate = {
      ok: false,
      error: error instanceof Error ? error.message : 'merge-topic failed',
      sourceTopic,
      targetTopic,
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
