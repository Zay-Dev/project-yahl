import fs from 'node:fs/promises';
import path from 'node:path';

import { runUpsertKnowledgePage } from '/opt/nixery/knowledge-wiki/upsert.js';
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

const parseValue = (input) => {
  if (input.value === undefined) {
    return undefined;
  }

  if (typeof input.value === 'object') {
    return input.value;
  }

  if (typeof input.value !== 'string' || !input.value.trim()) {
    return input.value;
  }

  try {
    return JSON.parse(input.value);
  } catch {
    return input.value;
  }
};

const toCanonicalWikiPath = (result) => {
  const candidates = [result.wikiPath, result.relativePath, result.path, result.pagePath]
    .filter((item) => typeof item === 'string' && item.trim());

  const raw = candidates[0]?.trim() ?? '';

  return raw.replace(/^en\//, '');
};

const toGateResult = (result) => {
  if (result.ok) {
    const path = toCanonicalWikiPath(result);

    if (!path) {
      return { ok: false, error: 'upsert succeeded without wiki path' };
    }

    return { ok: true, path };
  }

  return { ok: false, error: result.error ?? 'upsert failed' };
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

  logProgress(defId, `start topic=${input.topic ?? ''} key=${input.key ?? ''} page=${input.page ?? ''}`);

  const result = await runUpsertKnowledgePage({
    content: typeof input.content === 'string' ? input.content : undefined,
    key: typeof input.key === 'string' ? input.key : undefined,
    mode: input.mode === 'append' || input.mode === 'create' || input.mode === 'replace'
      ? input.mode
      : undefined,
    page: typeof input.page === 'string' ? input.page : undefined,
    section: typeof input.section === 'string' ? input.section : undefined,
    seedUrls: parseSeedUrls(input.seedUrls),
    title: typeof input.title === 'string' ? input.title : undefined,
    topic: typeof input.topic === 'string' ? input.topic : undefined,
    topicText: typeof input.topicText === 'string' ? input.topicText : undefined,
    value: parseValue(input),
  });

  const gate = toGateResult(result);

  await fs.writeFile(outputPath, `${JSON.stringify(gate, null, 2)}\n`, 'utf8');
  await fs.writeFile(
    path.join(workspace, 'upsert-detail.json'),
    `${JSON.stringify(result, null, 2)}\n`,
    'utf8',
  );

  logProgress(defId, `done ok=${gate.ok} output=${outputName}`);

  if (!gate.ok) {
    process.exit(1);
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
