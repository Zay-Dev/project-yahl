import fs from 'node:fs/promises';
import path from 'node:path';

import { runSingleLlmCompletion } from '../lib/llm-completion.mjs';
import {
  appendNixeryRetryUserMessage,
  readNixeryRetryFeedback,
} from '../lib/nixery-retry-feedback.mjs';
import { logProgress, resolveDefId } from '../lib/run-agent.mjs';
import {
  parseJsonValue,
  readGuidelineSnippet,
  readSessionFile,
  writeSessionFile,
} from '../lib/session-fs.mjs';

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
  const topic = String(input.topic ?? input.goal ?? '').trim();
  const direction = typeof input.direction === 'string' ? input.direction.trim() : '';
  const url = typeof input.url === 'string' ? input.url.trim() : '';
  const source = typeof input.source === 'string' ? input.source.trim() : '';
  const mission = typeof input.mission === 'string' ? input.mission.trim() : '';
  const facts = parseJsonValue(input.facts);
  const sourceContent = source ? await readSessionFile(source) : '';
  const guidelineContent = await readGuidelineSnippet(input.guidelinePath);
  const sessionOutput = typeof input.outputPath === 'string' && input.outputPath.trim()
    ? input.outputPath.trim()
    : '';

  logProgress(defId, `start topic=${topic.slice(0, 120)} source=${source.slice(0, 120)}`);

  const messages = [
    {
      content: 'You are the YAHL research helper. Return Markdown with sections: Summary, Key points, Quotes/data, Open questions, Source URL.',
      role: 'system',
    },
    {
      content: [
        mission
          ? `Mission (do NOT describe the YAHL task process):\n${mission}`
          : '',
        direction ? `Direction: ${direction}` : '',
        url ? `Source URL: ${url}` : '',
        topic ? `Topic: ${topic}` : '',
        sourceContent
          ? `Reference source — study according to direction:\n${sourceContent}`
          : '',
        guidelineContent,
        facts ? `Facts:\n${JSON.stringify(facts, null, 2).slice(0, 8_000)}` : '',
        typeof input.need === 'string' && input.need.trim()
          ? `Need: ${input.need.trim()}`
          : '',
      ].filter(Boolean).join('\n\n'),
      role: 'user',
    },
  ];

  appendNixeryRetryUserMessage(messages, readNixeryRetryFeedback(input));

  const markdown = await runSingleLlmCompletion({
    defId,
    messages,
  });

  if (sessionOutput) {
    await writeSessionFile(sessionOutput, markdown);
  }

  const gate = {
    markdown,
    ok: true,
    outputPath: sessionOutput || undefined,
    topic: topic || undefined,
  };

  await fs.writeFile(outputPath, `${JSON.stringify(gate, null, 2)}\n`, 'utf8');

  logProgress(defId, `done markdown_chars=${markdown.length}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
