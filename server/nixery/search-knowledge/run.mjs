import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import { callChatWithLog, logProgress, resolveDefId } from '/opt/nixery/_shared/run-agent.mjs';

const execFileAsync = promisify(execFile);

const PLACEHOLDER_KEYS = new Set(['', 'placeholder', 'sk-no-auth-required']);
const ALLOWED_COMMANDS = new Set(['ls', 'cat', 'grep', 'echo']);
const MAX_TOOL_ROUNDS = 24;
const MAX_OUTPUT_CHARS = 12_000;

const hasRealApiKey = (apiKey) => {
  const trimmed = apiKey.trim().toLowerCase();

  return trimmed.length > 0 && !PLACEHOLDER_KEYS.has(trimmed);
};

const readText = async (filePath) => {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch {
    return '';
  }
};

const readJson = async (filePath) => {
  try {
    const raw = await fs.readFile(filePath, 'utf8');

    return JSON.parse(raw);
  } catch {
    return {};
  }
};

const renderTemplate = (template, values) =>
  template.replaceAll(/\{\{(\w+)\}\}/g, (_, key) => values[key] ?? '');

const truncate = (text) => {
  if (text.length <= MAX_OUTPUT_CHARS) {
    return text;
  }

  return `${text.slice(0, MAX_OUTPUT_CHARS)}\n...[truncated]`;
};

const parseShellCommand = (command) => {
  const trimmed = command.trim();

  if (!trimmed) {
    throw new Error('empty command');
  }

  const redirectMatch = trimmed.match(/^echo\s+((?:'[^']*'|"[^"]*"|[^\s>])+)\s*>\s*(.+)$/);

  if (redirectMatch) {
    const target = path.resolve(redirectMatch[2].trim().replace(/^['"]|['"]$/g, ''));

    if (!target.startsWith('/workspace/')) {
      throw new Error('redirect target must be under /workspace/');
    }

    let content = redirectMatch[1].trim();

    if (
      (content.startsWith("'") && content.endsWith("'"))
      || (content.startsWith('"') && content.endsWith('"'))
    ) {
      content = content.slice(1, -1);
    }

    return {
      argv: ['echo', content],
      binary: 'echo',
      redirectPath: target,
    };
  }

  if (/[;&|`$(){}<>]/.test(trimmed)) {
    throw new Error('shell metacharacters are not allowed');
  }

  const tokens = trimmed.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) ?? [];

  if (tokens.length === 0) {
    throw new Error('empty command');
  }

  const argv = tokens.map((token) =>
    token.replace(/^['"]|['"]$/g, ''));

  const binary = path.basename(argv[0]);

  if (!ALLOWED_COMMANDS.has(binary)) {
    throw new Error(`command not allowed: ${binary}`);
  }

  for (const arg of argv.slice(1)) {
    if (arg.startsWith('-')) {
      continue;
    }

    const resolved = path.resolve(arg.startsWith('/') ? arg : path.join('/workspace', arg));

    if (
      !resolved.startsWith('/data/knowledge_export/')
      && !resolved.startsWith('/workspace/')
      && resolved !== '/data/knowledge_export'
      && resolved !== '/workspace'
    ) {
      throw new Error(`path not allowed: ${arg}`);
    }
  }

  return { argv, binary };
};

const runShell = async (command) => {
  const parsed = parseShellCommand(command);
  const { argv, binary, redirectPath } = parsed;

  if (redirectPath) {
    await fs.mkdir(path.dirname(redirectPath), { recursive: true });
    await fs.writeFile(redirectPath, argv[1] ?? '', 'utf8');

    return `wrote ${redirectPath}`;
  }

  try {
    const { stderr, stdout } = await execFileAsync(binary, argv.slice(1), {
      cwd: '/workspace',
      env: {
        PATH: '/usr/bin:/bin',
      },
      maxBuffer: 2 * 1024 * 1024,
      timeout: 30_000,
    });

    return truncate([stdout, stderr].filter(Boolean).join('\n').trim() || '<empty>');
  } catch (error) {
    const stdout = error.stdout?.toString?.() ?? '';
    const stderr = error.stderr?.toString?.() ?? error.message ?? 'command failed';

    return truncate([stdout, stderr].filter(Boolean).join('\n').trim() || '<error>');
  }
};

const callChat = async (params) => {
  const base = params.baseUrl.replace(/\/+$/, '');
  const url = `${base}/chat/completions`;
  const headers = {
    'Content-Type': 'application/json',
  };

  if (hasRealApiKey(params.apiKey)) {
    headers.Authorization = `Bearer ${params.apiKey}`;
  }

  const response = await fetch(url, {
    body: JSON.stringify({
      max_tokens: params.maxTokens,
      messages: params.messages,
      model: params.model,
      temperature: params.temperature ?? 0.2,
      tools: params.tools,
    }),
    headers,
    method: 'POST',
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`openai chat failed: ${response.status} ${body.slice(0, 500)}`);
  }

  return response.json();
};

const shellTool = {
  function: {
    description: 'Run an allowlisted shell command: ls, cat, grep, echo. Use absolute paths under /data/knowledge_export or /workspace.',
    name: 'shell',
    parameters: {
      properties: {
        command: {
          description: 'Full command line starting with ls, cat, grep, or echo',
          type: 'string',
        },
      },
      required: ['command'],
      type: 'object',
    },
  },
  type: 'function',
};

const main = async () => {
  const workspace = '/workspace';
  const defRoot = '/opt/nixery/def';
  const defId = resolveDefId(defRoot);
  const input = await readJson(path.join(workspace, 'input.json'));
  const template = await readText(path.join(defRoot, 'prompt.template.md'));
  const inputValues = Object.fromEntries(
    Object.entries(input).map(([key, value]) => [key, String(value ?? '').trim()]),
  );
  const userPrompt = renderTemplate(template, inputValues);
  const apiKey = process.env.OPENAI_API_KEY?.trim() ?? '';
  const baseUrl = process.env.OPENAI_BASE_URL?.trim() ?? 'https://api.openai.com/v1';
  const model = process.env.OPENAI_MODEL?.trim() || 'gpt-4o';
  const temperature = Number(process.env.OPENAI_TEMPERATURE ?? '0.2');
  const maxTokens = process.env.OPENAI_MAX_TOKENS
    ? Number(process.env.OPENAI_MAX_TOKENS)
    : 8192;

  if (!hasRealApiKey(apiKey) && !process.env.HTTPS_PROXY && !process.env.HTTP_PROXY) {
    throw new Error('OPENAI_API_KEY is required when OneCLI proxy env is not set');
  }

  if (!userPrompt.trim()) {
    throw new Error('prompt.template.md is required');
  }

  logProgress(
    defId,
    `start topic=${inputValues.topic ?? ''} output=${inputValues.output ?? ''} `
    + `purpose=${(inputValues.purpose ?? '').slice(0, 120)}`,
  );

  const messages = [
    {
      content: [
        'You are a knowledge extraction agent inside a one-time nixery container.',
        'Explore /data/knowledge_export with ls, cat, grep before concluding absent.',
        'When absent:true, absentReason must list exploration steps tried (paths, grep patterns, files read) then why purpose is unmet.',
        'Write workflow artifacts under /workspace/ with echo and shell redirects.',
        'Stop when the task is complete.',
      ].join(' '),
      role: 'system',
    },
    {
      content: userPrompt,
      role: 'user',
    },
  ];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const json = await callChatWithLog(defId, round, () => callChat({
      apiKey,
      baseUrl,
      maxTokens: Number.isFinite(maxTokens) ? maxTokens : undefined,
      messages,
      model,
      temperature: Number.isFinite(temperature) ? temperature : 0.2,
      tools: [shellTool],
    }));

    const choice = json.choices?.[0]?.message;

    if (!choice) {
      throw new Error('openai chat returned no message');
    }

    messages.push(choice);

    const toolCalls = choice.tool_calls ?? [];

    if (toolCalls.length === 0) {
      break;
    }

    for (const toolCall of toolCalls) {
      if (toolCall.function?.name !== 'shell') {
        messages.push({
          content: `unsupported tool: ${toolCall.function?.name ?? 'unknown'}`,
          role: 'tool',
          tool_call_id: toolCall.id,
        });
        continue;
      }

      let args = {};

      try {
        args = JSON.parse(toolCall.function.arguments || '{}');
      } catch {
        args = {};
      }

      let output = '<error>';

      try {
        const command = String(args.command ?? '');

        logProgress(defId, `tool round=${round} command=${command.slice(0, 240)}`);
        output = await runShell(command);
        logProgress(defId, `tool round=${round} result_chars=${output.length}`);
      } catch (error) {
        output = error instanceof Error ? error.message : 'command failed';
      }

      messages.push({
        content: output,
        role: 'tool',
        tool_call_id: toolCall.id,
      });
    }
  }

  if (inputValues.output?.trim()) {
    const outputPath = path.join(workspace, inputValues.output.trim());

    try {
      const stat = await fs.stat(outputPath);

      logProgress(defId, `complete output=${outputPath} bytes=${stat.size}`);
    } catch {
      logProgress(defId, `complete output_missing path=${outputPath}`);
    }
  } else {
    logProgress(defId, 'complete no output hint');
  }
};

main().catch((error) => {
  console.error('[nixery-search-knowledge]', error);
  process.exit(1);
});
