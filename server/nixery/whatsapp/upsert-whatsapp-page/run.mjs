import fs from 'node:fs/promises';
import path from 'node:path';

import {
  resolveWhatsAppWikiPath,
  upsertWikiPage,
} from '/opt/nixery/plugin/lib/dist/index.js';
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
  const chatFolder = String(input.chatFolder ?? '').trim();
  const page = String(input.page ?? '').trim();
  const content = typeof input.content === 'string' ? input.content : '';
  const mode = input.mode === 'append' || input.mode === 'create' || input.mode === 'replace'
    ? input.mode
    : 'replace';

  if (!chatFolder || !page) {
    throw new Error('chatFolder and page are required');
  }

  const pagePath = resolveWhatsAppWikiPath(chatFolder, page);

  logProgress(defId, `upsert path=${pagePath} mode=${mode}`);

  const pageRecord = await upsertWikiPage({
    content,
    mode,
    pagePath,
    title: typeof input.title === 'string' ? input.title : undefined,
  });

  const result = {
    ok: true,
    path: pageRecord.path,
    pagePath,
  };

  await fs.writeFile(path.join(workspace, outputName), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  logProgress(defId, `done path=${pagePath}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
