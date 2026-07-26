import fs from 'node:fs/promises';
import path from 'node:path';

import { resolveCanonicalTopic } from '/opt/nixery/knowledge-wiki/topic-registry.js';
import { logProgress, resolveDefId } from '../_shared/run-agent.mjs';

const readJson = async (filePath) => {
  const raw = await fs.readFile(filePath, 'utf8');

  return JSON.parse(raw);
};

const parseSeedUrls = (value) => {
  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === 'string');
  }

  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);

      if (Array.isArray(parsed)) {
        return parsed.filter((item) => typeof item === 'string');
      }
    } catch {
      return value.split(',').map((item) => item.trim()).filter(Boolean);
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

  const topicText = typeof input.topicText === 'string' ? input.topicText.trim() : undefined;
  const slug = typeof input.slug === 'string'
    ? input.slug.trim()
    : typeof input.topic === 'string'
      ? input.topic.trim()
      : undefined;
  const seedUrls = parseSeedUrls(input.seedUrls);

  logProgress(defId, `start topicText=${topicText ?? ''} slug=${slug ?? ''}`);

  try {
    const resolved = await resolveCanonicalTopic({
      seedUrls,
      slug,
      topicText,
    });

    const gate = {
      ok: true,
      ...resolved,
    };

    await fs.writeFile(outputPath, `${JSON.stringify(gate, null, 2)}\n`, 'utf8');
    logProgress(defId, `done ok=true canonical=${resolved.canonical} matchedBy=${resolved.matchedBy}`);
  } catch (error) {
    const gate = {
      ok: false,
      error: error instanceof Error ? error.message : 'resolve-topic failed',
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
