import fs from 'node:fs/promises';
import path from 'node:path';

import { runUpsertKnowledgePage } from '/opt/nixery/plugin/lib/dist/upsert.js';
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
  const page = typeof input.page === 'string' ? input.page.trim().replace(/^\/+/, '') : '';
  const topic = typeof input.topic === 'string' ? input.topic.trim() : '';
  const content = typeof input.content === 'string' ? input.content : '';

  if (!topic || !page || !content) {
    const gate = { ok: false, error: 'topic, page, and content are required' };

    await fs.writeFile(outputPath, `${JSON.stringify(gate, null, 2)}\n`, 'utf8');
    process.exit(1);
  }

  if (!page.startsWith('raw/')) {
    const gate = { ok: false, error: 'append-raw-knowledge-page only allows page under raw/' };

    await fs.writeFile(outputPath, `${JSON.stringify(gate, null, 2)}\n`, 'utf8');
    process.exit(1);
  }

  logProgress(defId, `raw append topic=${topic} page=${page}`);

  const result = await runUpsertKnowledgePage({
    topic,
    page,
    content,
    mode: input.mode === 'replace' || input.mode === 'create' ? input.mode : 'append',
    title: typeof input.title === 'string' ? input.title : undefined,
  });

  const wikiPath = result.ok
    ? String(result.wikiPath ?? result.pagePath ?? result.path ?? '').replace(/^en\//, '')
    : '';
  const gate = result.ok && wikiPath
    ? { ok: true, path: wikiPath }
    : { ok: false, error: result.error ?? 'raw append failed' };

  await fs.writeFile(outputPath, `${JSON.stringify(gate, null, 2)}\n`, 'utf8');

  if (!gate.ok) {
    process.exit(1);
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
