import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import {
  formatRequiredPagesForPrompt,
  formatSuggestedPagesForPrompt,
} from '/opt/nixery/plugin/lib/dist/content-model.js';
import {
  callChat,
  callChatWithLog,
  logProgress,
  resolveDefId,
} from '../lib/run-agent.mjs';
import {
  appendNixeryRetryUserMessage,
  readNixeryRetryFeedback,
} from '../lib/nixery-retry-feedback.mjs';
import {
  handleWriteWorkspaceFileCall,
  writeWorkspaceFileTool,
} from '../lib/workspace-write.mjs';

const execFileAsync = promisify(execFile);

const ALLOWED_COMMANDS = new Set(['ls', 'cat', 'grep', 'echo']);
const MAX_TOOL_ROUNDS = 24;
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

const formatOptionalBlock = (label, value) => {
  const trimmed = String(value ?? '').trim();

  if (!trimmed) {
    return '';
  }

  return `${label}:\n${trimmed}`;
};

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

  const argv = tokens.map((token) => token.replace(/^['"]|['"]$/g, ''));
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
      env: { PATH: '/usr/bin:/bin' },
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
    description: 'Run ls, cat, grep, echo under /data/knowledge_export or /workspace.',
    name: 'shell',
    parameters: {
      properties: {
        command: { description: 'Command line', type: 'string' },
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

const main = async () => {
  const workspace = '/workspace';
  const defRoot = '/opt/nixery/def';
  const defId = resolveDefId(defRoot);
  const input = await readJson(path.join(workspace, 'input.json'));
  const template = await readText(path.join(defRoot, 'prompt.template.md'));
  const topic = String(input.topic ?? '').trim();
  const purpose = String(input.purpose ?? '').trim();
  const goal = String(input.goal ?? '').trim() || 'build study plan and wiki structure';
  const outputName = String(input.output ?? '').trim() || 'plan.json';
  const outputPath = path.join(workspace, outputName);
  const userPrompt = renderTemplate(template, {
    corpusAssessmentBlock: formatOptionalBlock('Corpus assessment', input.corpus_assessment),
    goal,
    guidelineBlock: formatOptionalBlock('Guideline (untrusted hints)', input.guideline),
    learningContractBlock: formatOptionalBlock('Learning contract', input.learning_contract),
    missionBlock: formatOptionalBlock('Mission', input.mission),
    purpose,
    requiredPagesBlock: formatRequiredPagesForPrompt(),
    suggestedPagesBlock: formatSuggestedPagesForPrompt(),
    todayBlock: formatOptionalBlock('Today', input.today),
    todoPickupBlock: formatOptionalBlock('Todo pickup', input.todo_pickup),
    topic,
    output: outputName,
  });
  const baseUrl = process.env.OPENAI_BASE_URL?.trim() ?? 'http://llm-proxy:4100/v1';
  const model = process.env.OPENAI_MODEL?.trim() || 'gpt-4o';
  const temperature = Number(process.env.OPENAI_TEMPERATURE ?? '0.2');
  const maxTokens = process.env.OPENAI_MAX_TOKENS
    ? Number(process.env.OPENAI_MAX_TOKENS)
    : 8192;

  if (!topic || !purpose) {
    throw new Error('plan-study requires topic and purpose');
  }

  logProgress(defId, `start topic=${topic} output=${outputName}`);

  const messages = [
    {
      content: [
        'You are a knowledge study planning agent inside a one-time nixery container.',
        'Review the export corpus, define wiki_structure and study_plan JSON.',
        'Write plan.json with write_workspace_file.',
      ].join(' '),
      role: 'system',
    },
    { content: userPrompt, role: 'user' },
  ];

  appendNixeryRetryUserMessage(messages, readNixeryRetryFeedback(input));

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
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
        output = error instanceof Error ? error.message : 'tool failed';
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
};

main().catch((error) => {
  console.error('[nixery-plan-study]', error);
  process.exit(1);
});
