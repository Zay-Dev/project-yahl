import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

import { logProgress, resolveDefId } from '../_shared/run-agent.mjs';
import { resolveSessionPath } from '../_shared/session-fs.mjs';

const CURSOR_AGENT_ROOT = '/opt/cursor-agent';

const readJson = async (filePath) => {
  const raw = await fs.readFile(filePath, 'utf8');

  return JSON.parse(raw);
};

const resolveMediaPath = (input) => {
  const resolved = resolveSessionPath(input);

  if (!resolved) {
    return '';
  }

  if (resolved.startsWith('/session/') || resolved === '/session') {
    return resolved;
  }

  const sessionMatch = resolved.match(/\/sessions\/[^/]+\/(.+)$/);

  if (sessionMatch?.[1]) {
    return path.join('/session', sessionMatch[1]);
  }

  return resolved;
};

const resolveCursorAgentBin = async () => {
  const candidates = [
    path.join(CURSOR_AGENT_ROOT, 'agent'),
    path.join(CURSOR_AGENT_ROOT, 'cursor-agent'),
  ];

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);

      return candidate;
    } catch {
      // try next
    }
  }

  throw new Error(
    'cursor-agent missing under /opt/cursor-agent — rebuild media-to-text dockerfile image (Cursor is installed at docker build)',
  );
};

const MEDIA_TEXT_RE = /<<<MEDIA_TEXT>>>\s*([\s\S]*?)\s*<<<END_MEDIA_TEXT>>>/;

const extractTextFromCliOutput = (stdout) => {
  const trimmed = String(stdout ?? '').trim();

  if (!trimmed) {
    return '';
  }

  try {
    const parsed = JSON.parse(trimmed);

    if (typeof parsed === 'string') {
      return parsed.trim();
    }

    if (parsed && typeof parsed === 'object') {
      if (typeof parsed.result === 'string') {
        return parsed.result.trim();
      }

      if (typeof parsed.text === 'string') {
        return parsed.text.trim();
      }
    }
  } catch {
    // fall through to raw stdout
  }

  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);

  if (fence?.[1]) {
    try {
      const inner = JSON.parse(fence[1].trim());

      if (typeof inner?.result === 'string') {
        return inner.result.trim();
      }

      if (typeof inner?.text === 'string') {
        return inner.text.trim();
      }
    } catch {
      // ignore
    }
  }

  return trimmed;
};

const extractMediaTextBlock = (raw) => {
  const match = String(raw ?? '').match(MEDIA_TEXT_RE);

  if (!match) {
    throw new Error('media-to-text missing MEDIA_TEXT block');
  }

  const text = match[1].trim();

  if (!text) {
    throw new Error('media-to-text MEDIA_TEXT block is empty');
  }

  return text;
};

const runCursorCli = (bin, prompt, cwd) => new Promise((resolve, reject) => {
  const apiKey = process.env.CURSOR_API_KEY?.trim() ?? '';

  if (!apiKey) {
    reject(new Error('CURSOR_API_KEY missing'));

    return;
  }

  const sslCert = process.env.SSL_CERT_FILE?.trim()
    || process.env.NODE_EXTRA_CA_CERTS?.trim()
    || '';

  const child = spawn(bin, [
    '-p',
    '--force',
    '--yolo',
    '--output-format',
    'json',
    prompt,
  ], {
    cwd,
    env: {
      ...process.env,
      CURSOR_API_KEY: apiKey,
      HOME: cwd,
      // Cursor agent + OneCLI HTTPS MITM is unreliable; prefer direct egress
      HTTP_PROXY: '',
      HTTPS_PROXY: '',
      http_proxy: '',
      https_proxy: '',
      ...(sslCert
        ? { NODE_EXTRA_CA_CERTS: sslCert, SSL_CERT_FILE: sslCert }
        : {}),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stdout = '';
  let stderr = '';

  child.stdout?.on('data', (chunk) => {
    stdout += chunk.toString();
  });

  child.stderr?.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  child.on('error', reject);

  child.on('close', (code) => {
    if (code !== 0) {
      reject(new Error(
        `cursor-agent exited ${code}${stderr.trim() ? `: ${stderr.trim().slice(0, 400)}` : ''}`,
      ));

      return;
    }

    resolve(stdout);
  });
});

const main = async () => {
  const workspace = '/workspace';
  const defRoot = '/opt/nixery/def';
  const defId = resolveDefId(defRoot);
  const input = await readJson(path.join(workspace, 'input.json'));
  const outputName = typeof input.output === 'string' && input.output.trim()
    ? input.output.trim()
    : 'result.json';
  const outputPath = path.join(workspace, outputName);
  const fileArg = typeof input.file === 'string' ? input.file.trim() : '';

  if (!fileArg) {
    throw new Error('media-to-text requires file');
  }

  const filePath = resolveMediaPath(fileArg);

  if (!filePath) {
    throw new Error('media-to-text requires a resolvable file path');
  }

  await fs.access(filePath);

  const template = await fs.readFile(path.join(defRoot, 'prompt.template.md'), 'utf8');
  const prompt = template.replaceAll('{{FILE_PATH}}', filePath);
  const bin = await resolveCursorAgentBin();

  logProgress(defId, `start file=${fileArg} resolved=${filePath}`);

  const stdout = await runCursorCli(bin, prompt, workspace);
  const raw = extractTextFromCliOutput(stdout);

  if (!raw) {
    throw new Error('media-to-text returned empty text');
  }

  const text = extractMediaTextBlock(raw);

  const gate = {
    ok: true,
    file: fileArg,
    text,
  };

  await fs.writeFile(outputPath, `${JSON.stringify(gate, null, 2)}\n`, 'utf8');

  logProgress(defId, `done output=${outputName} chars=${text.length}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
