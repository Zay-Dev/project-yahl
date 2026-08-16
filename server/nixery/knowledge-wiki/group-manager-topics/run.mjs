import fs from 'node:fs/promises';
import path from 'node:path';

import {
  groupManagerTopics,
  listManagerTopics,
} from '/opt/nixery/plugin/lib/dist/index.js';
import { logProgress, resolveDefId } from '../lib/run-agent.mjs';

const readJson = async (filePath) => {
  const raw = await fs.readFile(filePath, 'utf8');

  return JSON.parse(raw);
};

const parseTopics = (input) => {
  if (Array.isArray(input.topics)) {
    return input.topics.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim());
  }

  if (typeof input.topics === 'string' && input.topics.trim()) {
    try {
      const parsed = JSON.parse(input.topics);

      if (Array.isArray(parsed)) {
        return parsed.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim());
      }
    } catch {
      return input.topics.split(',').map((item) => item.trim()).filter(Boolean);
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

  logProgress(defId, 'start');

  try {
    const topics = parseTopics(input) ?? await listManagerTopics();
    const topic_groups = groupManagerTopics(topics);
    const gate = {
      ok: true,
      topic_groups,
      topics,
    };

    await fs.writeFile(outputPath, `${JSON.stringify(gate, null, 2)}\n`, 'utf8');
    logProgress(defId, `done ok=true groups=${topic_groups.length}`);
  } catch (error) {
    const gate = {
      ok: false,
      error: error instanceof Error ? error.message : 'group-manager-topics failed',
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
