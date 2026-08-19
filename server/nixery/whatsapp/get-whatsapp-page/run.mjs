import fs from 'node:fs/promises';
import path from 'node:path';

import {
  getWikiPageByPath,
  resolveWhatsAppWikiPath,
} from '/opt/nixery/plugin/lib/dist/index.js';
import { logProgress, resolveDefId } from '../lib/run-agent.mjs';

const readJson = async (filePath) => {
  const raw = await fs.readFile(filePath, 'utf8');

  return JSON.parse(raw);
};

const artifactName = (chatFolder, page) => {
  const folder = String(chatFolder).replace(/[^a-zA-Z0-9._-]+/g, '-');
  const pageSeg = String(page).replace(/[^a-zA-Z0-9._-]+/g, '-');

  return `wiki-${folder}-${pageSeg}.md`;
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

  if (!chatFolder || !page) {
    throw new Error('chatFolder and page are required');
  }

  const pagePath = resolveWhatsAppWikiPath(chatFolder, page);
  const markdown = artifactName(chatFolder, page);

  logProgress(defId, `get path=${pagePath}`);

  const pageRecord = await getWikiPageByPath(pagePath);
  const absent = !pageRecord;
  const content = pageRecord?.content ?? '';

  if (absent) {
    await fs.writeFile(
      path.join(workspace, markdown),
      `---\nabsent: true\npagePath: ${pagePath}\n---\n`,
      'utf8',
    );
  } else {
    await fs.writeFile(path.join(workspace, markdown), `${content.trim()}\n`, 'utf8');
  }

  const result = {
    ok: true,
    absent,
    path: pageRecord?.path ?? pagePath,
    pagePath,
    title: pageRecord?.title,
    markdown,
    content: absent ? null : content,
  };

  await fs.writeFile(path.join(workspace, outputName), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  logProgress(defId, `done path=${pagePath} absent=${absent}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
