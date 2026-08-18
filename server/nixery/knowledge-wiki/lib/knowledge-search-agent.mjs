import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import {
  callChat,
  callChatWithLog,
  logProgress,
  resolveDefId,
} from './run-agent.mjs';
import {
  appendNixeryRetryUserMessage,
  readNixeryRetryFeedback,
} from './nixery-retry-feedback.mjs';
import {
  handleWriteWorkspaceFileCall,
  writeWorkspaceFileTool,
} from './workspace-write.mjs';

const execFileAsync = promisify(execFile);

const ALLOWED_COMMANDS = new Set(['ls', 'cat', 'grep', 'echo']);
const DEFAULT_MAX_TOOL_ROUNDS = 24;
const MAX_OUTPUT_CHARS = 12_000;

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

const handleToolCall = async (toolCall, round, defId) => {
  const name = toolCall.function?.name ?? '';
  let args = {};

  try {
    args = JSON.parse(toolCall.function.arguments || '{}');
  } catch {
    args = {};
  }

  if (name === 'write_workspace_file') {
    logProgress(defId, `tool round=${round} write_workspace_file path=${String(args.path ?? '').slice(0, 120)}`);
    const output = await handleWriteWorkspaceFileCall(args);

    logProgress(defId, `tool round=${round} result_chars=${output.length}`);

    return output;
  }

  if (name !== 'shell') {
    return `unsupported tool: ${name}`;
  }

  const command = String(args.command ?? '');

  logProgress(defId, `tool round=${round} command=${command.slice(0, 240)}`);
  const output = await runShell(command);

  logProgress(defId, `tool round=${round} result_chars=${output.length}`);

  return output;
};

const defaultSystemContent = [
  'You are a knowledge extraction agent inside a one-time nixery container.',
  'Explore /data/knowledge_export with ls, cat, grep before concluding absent.',
  'When absent:true, absentReason must list exploration steps tried (paths, grep patterns, files read) then why purpose is unmet.',
  'Write the primary markdown artifact with write_workspace_file — YAML frontmatter plus body.',
  'Use shell only for exploration and notes — not for the primary artifact.',
  'Stop when the task is complete.',
].join(' ');

export const runKnowledgeSearchAgent = async (params = {}) => {
  const workspace = params.workspace ?? '/workspace';
  const defRoot = params.defRoot ?? '/opt/nixery/def';
  const defId = params.defId ?? resolveDefId(defRoot);
  const input = params.input ?? await readJson(path.join(workspace, 'input.json'));
  const inputValues = Object.fromEntries(
    Object.entries(input).map(([key, value]) => [key, String(value ?? '').trim()]),
  );
  const scopeValues = typeof params.beforeRender === 'function'
    ? await params.beforeRender({ input, inputValues })
    : {};
  const templateValues = {
    ...inputValues,
    ...(scopeValues && typeof scopeValues === 'object' ? scopeValues : {}),
  };
  const outputName = params.outputName?.trim()
    || inputValues.output?.trim()
    || 'output.md';
  const outputPath = path.join(workspace, outputName);
  const template = params.userPrompt === undefined
    ? await readText(params.templatePath ?? path.join(defRoot, 'prompt.template.md'))
    : '';
  const userPrompt = params.userPrompt ?? renderTemplate(template, templateValues);
  const baseUrl = process.env.OPENAI_BASE_URL?.trim() ?? 'http://llm-proxy:4100/v1';
  const model = process.env.OPENAI_MODEL?.trim() || 'gpt-4o';
  const temperature = Number(process.env.OPENAI_TEMPERATURE ?? '0.2');
  const maxTokens = process.env.OPENAI_MAX_TOKENS
    ? Number(process.env.OPENAI_MAX_TOKENS)
    : 8192;
  const maxToolRounds = params.maxToolRounds ?? DEFAULT_MAX_TOOL_ROUNDS;

  if (!userPrompt.trim()) {
    throw new Error('knowledge search prompt is required');
  }

  logProgress(
    defId,
    `start topic=${inputValues.topic ?? ''} `
    + `canonical=${templateValues.canonicalTopic ?? inputValues.topic ?? ''} `
    + `includeRaw=${templateValues.includeRaw ?? 'n/a'} `
    + `output=${outputName} `
    + `purpose=${(inputValues.purpose ?? inputValues.query ?? '').slice(0, 120)}`,
  );

  const messages = [
    {
      content: params.systemContent ?? defaultSystemContent,
      role: 'system',
    },
    {
      content: userPrompt,
      role: 'user',
    },
  ];

  appendNixeryRetryUserMessage(messages, readNixeryRetryFeedback(input));

  for (let round = 0; round < maxToolRounds; round += 1) {
    const json = await callChatWithLog(defId, round, () => callChat({
        baseUrl,
      maxTokens: Number.isFinite(maxTokens) ? maxTokens : undefined,
      messages,
      model,
      temperature: Number.isFinite(temperature) ? temperature : 0.2,
      tools: [shellTool, writeWorkspaceFileTool],
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
      let output = '<error>';

      try {
        output = await handleToolCall(toolCall, round, defId);
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

  const stat = await fs.stat(outputPath);

  logProgress(defId, `complete output=${outputPath} bytes=${stat.size}`);

  return { input, inputValues, outputName, outputPath };
};
