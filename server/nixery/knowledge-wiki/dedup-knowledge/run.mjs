import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import { applyDedupAction } from '/opt/nixery/plugin/lib/dist/dedup.js';
import {
  callChatWithLog,
  hasRealApiKey,
  logProgress,
  resolveDefId,
} from '../lib/run-agent.mjs';
import {
  appendNixeryRetryUserMessage,
  readNixeryRetryFeedback,
} from '../lib/nixery-retry-feedback.mjs';
import {
  callChatForPhase,
  resolvePhaseLlmConfig,
} from '/opt/nixery/def/phase-llm.mjs';

const execFileAsync = promisify(execFile);

const ALLOWED_COMMANDS = new Set(['ls', 'cat', 'grep', 'echo']);
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
    return null;
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

const wikiTool = {
  function: {
    description: 'Apply deterministic wiki dedup repair via GraphQL.',
    name: 'wiki',
    parameters: {
      properties: {
        action: { type: 'string' },
        id: { type: 'string' },
        pagePath: { type: 'string' },
        sectionTitle: { type: 'string' },
      },
      required: ['action', 'pagePath'],
      type: 'object',
    },
  },
  type: 'function',
};

const runAgentPhase = async ({
  defId,
  maxRounds,
  phase,
  prompt,
  retryFeedback,
  tools,
  toolHandler,
}) => {
  const config = resolvePhaseLlmConfig(phase);
  const messages = [
    {
      content: `You are a nixery ${phase} agent. Complete the task and write required workspace artifacts.`,
      role: 'system',
    },
    { content: prompt, role: 'user' },
  ];

  appendNixeryRetryUserMessage(messages, retryFeedback);

  if (!hasRealApiKey(config.apiKey) && !process.env.HTTPS_PROXY && !process.env.HTTP_PROXY) {
    throw new Error('OPENAI_API_KEY is required when OneCLI proxy env is not set');
  }

  for (let round = 0; round < maxRounds; round += 1) {
    const json = await callChatWithLog(defId, round, () => callChatForPhase(phase, {
      messages,
      tools,
    }));

    const choice = json.choices?.[0]?.message;

    if (!choice) {
      throw new Error(`openai chat returned no message (${phase})`);
    }

    messages.push(choice);
    const toolCalls = choice.tool_calls ?? [];

    if (toolCalls.length === 0) {
      break;
    }

    for (const toolCall of toolCalls) {
      let args = {};

      try {
        args = JSON.parse(toolCall.function.arguments || '{}');
      } catch {
        args = {};
      }

      let output = '<error>';

      try {
        output = await toolHandler(toolCall.function?.name, args);
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
};

const parseScope = (value) => {
  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === 'string');
  }

  if (typeof value !== 'string' || !value.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);

    if (Array.isArray(parsed)) {
      return parsed.filter((item) => typeof item === 'string');
    }
  } catch {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }

  return [];
};

const parseDryRun = (value) =>
  value === true
  || value === 'true'
  || value === '1'
  || value === 1;

const reviewJsonName = 'dedup-review.json';
const reviewMdName = 'dedup-review.md';

const toGateResult = (review) => {
  if (review?.ok === true) {
    return { ok: true };
  }

  return {
    error: typeof review?.summary === 'string' ? review.summary : 'dedup incomplete',
    ok: false,
  };
};

const writeDedupArtifacts = async ({
  defId,
  gateOutputName,
  input,
  review,
  workspace,
}) => {
  const gate = toGateResult(review);
  const gatePath = path.join(workspace, gateOutputName);

  await fs.writeFile(
    path.join(workspace, reviewJsonName),
    `${JSON.stringify(review, null, 2)}\n`,
    'utf8',
  );
  await fs.writeFile(
    path.join(workspace, reviewMdName),
    `# Dedup review\n\n\`\`\`json\n${JSON.stringify(review, null, 2)}\n\`\`\`\n`,
    'utf8',
  );
  await fs.writeFile(gatePath, `${JSON.stringify(gate, null, 2)}\n`, 'utf8');

  logProgress(defId, `done ok=${gate.ok} output=${gateOutputName}`);

  if (!gate.ok) {
    process.exit(1);
  }
};

const main = async () => {
  const workspace = '/workspace';
  const defRoot = '/opt/nixery/def';
  const defId = resolveDefId(defRoot);
  const input = await readJson(path.join(workspace, 'input.json')) ?? {};
  const topic = String(input.topic ?? '').trim();
  const purpose = String(input.purpose ?? '').trim();
  const scope = parseScope(input.scope);
  const dryRun = parseDryRun(input.dryRun);
  const gateOutputName = typeof input.output === 'string' && input.output.trim()
    ? input.output.trim()
    : 'result.json';
  const maxCycles = Number(process.env.MAX_EXECUTE_REVIEW_CYCLES ?? '3') || 3;

  if (!topic || !purpose) {
    throw new Error('dedup-knowledge requires topic and purpose');
  }

  const planTemplate = await readText(path.join(defRoot, 'prompt.plan.template.md'));
  const executeTemplate = await readText(path.join(defRoot, 'prompt.execute.template.md'));
  const reviewTemplate = await readText(path.join(defRoot, 'prompt.review.template.md'));
  const scopeText = scope.length ? scope.join(', ') : '(all pages)';
  const retryFeedback = readNixeryRetryFeedback(input);

  logProgress(defId, `plan start topic=${topic} dryRun=${dryRun}`);

  await runAgentPhase({
    defId,
    retryFeedback,
    maxRounds: 12,
    phase: 'plan',
    prompt: renderTemplate(planTemplate, { purpose, scope: scopeText, topic }),
    tools: [shellTool],
    toolHandler: async (name, args) => {
      if (name !== 'shell') {
        return `unsupported tool: ${name}`;
      }

      return runShell(String(args.command ?? ''));
    },
  });

  const todo = await readJson(path.join(workspace, 'dedup-todo.json'));

  if (!todo?.items?.length) {
    const review = {
      exhausted: false,
      followUpItems: [],
      maxCycles,
      ok: true,
      remainingIssues: [],
      summary: 'No dedup items found during plan',
      cycle: 0,
    };

    await writeDedupArtifacts({
      defId,
      gateOutputName,
      input,
      review,
      workspace,
    });

    return;
  }

  if (dryRun) {
    await runAgentPhase({
      defId,
      maxRounds: 8,
      phase: 'review',
      prompt: renderTemplate(reviewTemplate, {
        appliedJson: JSON.stringify({ dryRun: true, todo }, null, 2),
        cycle: '0',
        maxCycles: String(maxCycles),
        purpose,
        topic,
      }),
      retryFeedback,
      tools: [shellTool],
      toolHandler: async (name, args) => {
        if (name !== 'shell') {
          return `unsupported tool: ${name}`;
        }

        return runShell(String(args.command ?? ''));
      },
    });

    const dryRunReview = await readJson(path.join(workspace, reviewJsonName)) ?? {
      cycle: 0,
      followUpItems: [],
      maxCycles,
      ok: true,
      summary: 'Dry run review complete',
    };

    await writeDedupArtifacts({
      defId,
      gateOutputName,
      input,
      review: dryRunReview,
      workspace,
    });

    return;
  }

  let workQueue = todo.items;
  let cycle = 0;
  let terminalReview = null;

  while (cycle < maxCycles) {
    cycle += 1;

    logProgress(defId, `execute cycle=${cycle} items=${workQueue.length}`);

    await runAgentPhase({
      defId,
      maxRounds: 24,
      phase: 'execute',
      prompt: renderTemplate(executeTemplate, {
        cycle: String(cycle),
        topic,
        workQueue: JSON.stringify(workQueue, null, 2),
      }),
      retryFeedback,
      tools: [shellTool, wikiTool],
      toolHandler: async (name, args) => {
        if (name === 'shell') {
          return runShell(String(args.command ?? ''));
        }

        if (name === 'wiki') {
          const result = await applyDedupAction({
            action: String(args.action ?? ''),
            id: typeof args.id === 'string' ? args.id : undefined,
            pagePath: String(args.pagePath ?? ''),
            sectionTitle: typeof args.sectionTitle === 'string' ? args.sectionTitle : undefined,
          });

          return JSON.stringify(result);
        }

        return `unsupported tool: ${name}`;
      },
    });

    const applied = await readJson(path.join(workspace, 'dedup-applied.json')) ?? {
      applied: [],
      cycle,
      skipped: [],
    };

    logProgress(defId, `review cycle=${cycle}`);

    await runAgentPhase({
      defId,
      maxRounds: 8,
      phase: 'review',
      prompt: renderTemplate(reviewTemplate, {
        appliedJson: JSON.stringify(applied, null, 2),
        cycle: String(cycle),
        maxCycles: String(maxCycles),
        purpose,
        topic,
      }),
      retryFeedback,
      tools: [shellTool],
      toolHandler: async (name, args) => {
        if (name !== 'shell') {
          return `unsupported tool: ${name}`;
        }

        return runShell(String(args.command ?? ''));
      },
    });

    terminalReview = await readJson(path.join(workspace, reviewJsonName));

    const followUpItems = Array.isArray(terminalReview?.followUpItems)
      ? terminalReview.followUpItems
      : [];

    if (!followUpItems.length || terminalReview?.ok === true) {
      break;
    }

    workQueue = followUpItems;
  }

  if (terminalReview) {
    const followUpItems = Array.isArray(terminalReview.followUpItems)
      ? terminalReview.followUpItems
      : [];

    if (followUpItems.length && cycle >= maxCycles) {
      terminalReview.exhausted = true;
      terminalReview.ok = false;
    }

    terminalReview.cycle = cycle;
    terminalReview.maxCycles = maxCycles;

    await writeDedupArtifacts({
      defId,
      gateOutputName,
      input,
      review: terminalReview,
      workspace,
    });
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
