import fs from 'node:fs/promises';
import path from 'node:path';

import { runSingleLlmCompletion } from '../lib/llm-completion.mjs';
import {
  appendNixeryRetryUserMessage,
  readNixeryRetryFeedback,
} from '../lib/nixery-retry-feedback.mjs';
import { logProgress, resolveDefId } from '../lib/run-agent.mjs';
import { resolveSessionPath } from '../lib/session-fs.mjs';

const MAX_IMAGE_BYTES = 32 * 1024 * 1024;

const SYSTEM_PROMPT = [
  'You are the YAHL image-to-text helper.',
  'Extract all readable text from the image and describe what is in the image objectively.',
  'Use the provided background only as situational context.',
  'Use any user prompt as extra focus; do not invent details that are not visible.',
  'Return plain text.',
].join(' ');

const sniffImageMime = (buf) => {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg';
  }

  if (
    buf.length >= 8
    && buf[0] === 0x89
    && buf[1] === 0x50
    && buf[2] === 0x4e
    && buf[3] === 0x47
  ) {
    return 'image/png';
  }

  if (
    buf.length >= 6
    && buf[0] === 0x47
    && buf[1] === 0x49
    && buf[2] === 0x46
  ) {
    return 'image/gif';
  }

  if (
    buf.length >= 12
    && buf[0] === 0x52
    && buf[1] === 0x49
    && buf[2] === 0x46
    && buf[3] === 0x46
    && buf[8] === 0x57
    && buf[9] === 0x45
    && buf[10] === 0x42
    && buf[11] === 0x50
  ) {
    return 'image/webp';
  }

  return '';
};

const readJson = async (filePath) => {
  const raw = await fs.readFile(filePath, 'utf8');

  return JSON.parse(raw);
};

const readImageBytes = async (source) => {
  const resolved = resolveSessionPath(source);

  if (!resolved) {
    throw new Error('image-to-text requires source');
  }

  const stat = await fs.stat(resolved);

  if (!stat.isFile()) {
    throw new Error(`image-to-text source is not a file: ${source}`);
  }

  if (stat.size > MAX_IMAGE_BYTES) {
    throw new Error(`image-to-text source exceeds ${MAX_IMAGE_BYTES} bytes`);
  }

  const buf = await fs.readFile(resolved);
  const mime = sniffImageMime(buf);

  if (!mime) {
    throw new Error('image-to-text supports JPEG, PNG, GIF, and WebP only');
  }

  return { buf, mime, resolved };
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
  const background = typeof input.background === 'string' ? input.background.trim() : '';
  const userPrompt = typeof input.userPrompt === 'string' ? input.userPrompt.trim() : '';

  if (!source) {
    throw new Error('image-to-text requires source');
  }

  if (!background) {
    throw new Error('image-to-text requires background');
  }

  logProgress(defId, `start source=${source.slice(0, 120)}`);

  const { buf, mime } = await readImageBytes(source);
  const b64 = buf.toString('base64');
  const textParts = [
    'Extract readable text and describe the image objectively.',
    `Background:\n${background}`,
  ];

  if (userPrompt) {
    textParts.push(`User prompt:\n${userPrompt}`);
  }

  const messages = [
    {
      content: SYSTEM_PROMPT,
      role: 'system',
    },
    {
      content: [
        { type: 'text', text: textParts.join('\n\n') },
        {
          type: 'image_url',
          image_url: { url: `data:${mime};base64,${b64}` },
        },
      ],
      role: 'user',
    },
  ];

  appendNixeryRetryUserMessage(messages, readNixeryRetryFeedback(input));

  const content = await runSingleLlmCompletion({
    defId,
    messages,
  });

  const gate = {
    ok: true,
    source,
    text: content,
  };

  await fs.writeFile(outputPath, `${JSON.stringify(gate, null, 2)}\n`, 'utf8');

  logProgress(defId, `done output=${outputName} chars=${content.length} mime=${mime}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
