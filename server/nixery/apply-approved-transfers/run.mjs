import fs from 'node:fs/promises';
import path from 'node:path';

import { applyApprovedTransfers } from '/opt/nixery/knowledge-wiki/index.js';
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

  if (!process.env.SESSION_API_BASE_URL?.trim()) {
    process.env.SESSION_API_BASE_URL = 'http://server:4000';
  }

  logProgress(defId, 'start');

  try {
    const approvedTransfersApplied = await applyApprovedTransfers();
    const gate = { ok: true, approvedTransfersApplied };

    await fs.writeFile(outputPath, `${JSON.stringify(gate, null, 2)}\n`, 'utf8');
    logProgress(defId, `done ok=true applied=${approvedTransfersApplied}`);
  } catch (error) {
    const gate = {
      ok: false,
      error: error instanceof Error ? error.message : 'apply-approved-transfers failed',
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
