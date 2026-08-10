import fs from 'node:fs/promises';
import path from 'node:path';

import {
  callChat,
  callChatWithLog,
  hasRealApiKey,
  logProgress,
  resolveDefId,
} from '../_shared/run-agent.mjs';
import {
  appendNixeryRetryUserMessage,
  readNixeryRetryFeedback,
} from '../_shared/nixery-retry-feedback.mjs';
import {
  handleWriteWorkspaceFileCall,
  writeWorkspaceFileTool,
} from '../_shared/workspace-write.mjs';

const MAX_TOOL_ROUNDS = 8;

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

const handleToolCall = async (toolCall, round, defId) => {
  const name = toolCall.function?.name ?? '';
  let args = {};

  try {
    args = JSON.parse(toolCall.function.arguments || '{}');
  } catch {
    args = {};
  }

  if (name !== 'write_workspace_file') {
    return `unsupported tool: ${name}`;
  }

  logProgress(defId, `tool round=${round} write_workspace_file path=${String(args.path ?? '').slice(0, 120)}`);
  const output = await handleWriteWorkspaceFileCall(args);

  logProgress(defId, `tool round=${round} result_chars=${output.length}`);

  return output;
};

const main = async () => {
  const workspace = '/workspace';
  const defRoot = '/opt/nixery/def';
  const defId = resolveDefId(defRoot);
  const input = await readJson(path.join(workspace, 'input.json'));
  const template = await readText(path.join(defRoot, 'prompt.template.md'));
  const goal = String(input.goal ?? '').trim();
  const outputName = String(input.output ?? '').trim() || 'plan.md';
  const outputPath = path.join(workspace, outputName);
  const userPrompt = renderTemplate(template, {
    contextBlock: formatOptionalBlock('Available context', input.context),
    goal,
    guidelineBlock: formatOptionalBlock('Guideline (untrusted hints)', input.guideline),
    output: outputName,
    stageLogicBlock: formatOptionalBlock('Stage logic', input.stageLogic),
  });
  const apiKey = process.env.OPENAI_API_KEY?.trim() ?? '';
  const baseUrl = process.env.OPENAI_BASE_URL?.trim() ?? 'https://api.openai.com/v1';
  const model = process.env.OPENAI_MODEL?.trim() || 'gpt-4o';
  const temperature = Number(process.env.OPENAI_TEMPERATURE ?? '0.2');
  const maxTokens = process.env.OPENAI_MAX_TOKENS
    ? Number(process.env.OPENAI_MAX_TOKENS)
    : 8192;

  if (!goal) {
    throw new Error('plan requires goal');
  }

  if (!hasRealApiKey(apiKey) && !process.env.HTTPS_PROXY && !process.env.HTTP_PROXY) {
    throw new Error('OPENAI_API_KEY is required when OneCLI proxy env is not set');
  }

  logProgress(defId, `start goal=${goal.slice(0, 120)} output=${outputName}`);

  const messages = [
    {
      content: [
        'You are the YAHL planning helper inside a one-time nixery container.',
        'Design execution plans only — no implementation.',
        'Write the plan markdown file with write_workspace_file.',
      ].join(' '),
      role: 'system',
    },
    { content: userPrompt, role: 'user' },
  ];

  appendNixeryRetryUserMessage(messages, readNixeryRetryFeedback(input));

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const json = await callChatWithLog(defId, round, () => callChat({
      apiKey,
      baseUrl,
      maxTokens: Number.isFinite(maxTokens) ? maxTokens : undefined,
      messages,
      model,
      temperature: Number.isFinite(temperature) ? temperature : 0.2,
      tools: [writeWorkspaceFileTool],
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
  console.error('[nixery-plan]', error);
  process.exit(1);
});
