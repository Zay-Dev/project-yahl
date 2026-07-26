import fs from 'node:fs/promises';
import path from 'node:path';

import { runSingleLlmCompletion } from '../_shared/llm-completion.mjs';
import { logProgress, resolveDefId } from '../_shared/run-agent.mjs';
import { readSessionFile } from '../_shared/session-fs.mjs';

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
  const source = typeof input.source === 'string' ? input.source.trim() : '';
  const need = typeof input.need === 'string' && input.need.trim()
    ? input.need.trim()
    : typeof input.purpose === 'string' && input.purpose.trim()
      ? input.purpose.trim()
      : 'key facts';

  if (!source) {
    throw new Error('extract-info requires source');
  }

  logProgress(defId, `start source=${source.slice(0, 120)}`);

  const sourceContent = await readSessionFile(source);
  const content = await runSingleLlmCompletion({
    defId,
    messages: [
      {
        content: 'You are the YAHL extract-info helper. Extract only what was requested. Return plain text or JSON.',
        role: 'system',
      },
      {
        content: [
          `Need: ${need}`,
          sourceContent ? `Source:\n${sourceContent}` : `Source path: ${source}`,
        ].join('\n\n'),
        role: 'user',
      },
    ],
  });

  const gate = {
    ok: true,
    source,
    text: content,
  };

  await fs.writeFile(outputPath, `${JSON.stringify(gate, null, 2)}\n`, 'utf8');

  logProgress(defId, `done output=${outputName} chars=${content.length}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
