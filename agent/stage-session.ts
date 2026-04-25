import config from "./config";

import path from "path";

import {
  parseStageEnvelope,
  type StageEnvelope,
  type StageSessionInput,
} from "../shared/stage-contract";

import {
  type ChatApiMessage,
  type ChatAssistantMessage,
  type ChatToolCall,
  type SetContextToolArguments,
  parseRagToolArguments,
  parseRunBashToolArguments,
  parseSetContextToolArguments,
  ragArgumentsToEnvelope,
  setContextArgumentsToEnvelope,
} from "../shared/stage-tools";

import { readFileUtf8 } from "./-utils/prompts";

type BootstrapMessage = {
  content: string;
  role: "system" | "user" | "assistant";
};

type StageRunner = {
  chatWithTools: (messages: ChatApiMessage[]) => Promise<{
    assistantMessage: ChatAssistantMessage;
  }>;
  runCommand: (command: string) => Promise<string>;
};

type StageSessionOptions = {
  maxBashCalls?: number;
  maxTurns?: number;
};

const toApiMessages = (messages: BootstrapMessage[]): ChatApiMessage[] =>
  messages.map((message) => ({
    content: message.content,
    role: message.role,
  }));

export const parseStageSessionInput = (text: string): StageSessionInput | null => {
  let parsedRaw: unknown;
  try {
    parsedRaw = JSON.parse(text) as unknown;
  } catch {
    return null;
  }

  if (!parsedRaw || typeof parsedRaw !== "object" || Array.isArray(parsedRaw)) return null;

  const parsed = parsedRaw as Record<string, unknown>;
  if (typeof parsed.currentStage !== "string") return null;

  if (!parsed.context) return null;
  if (typeof parsed.context !== 'object') return null;
  if (Array.isArray(parsed.context)) return null;

  const context = parsed.context as Record<string, unknown>;

  if (!context.context) return null;
  if (typeof context.context !== 'object') return null;
  if (Array.isArray(context.context)) return null;

  if (!context.stage) return null;
  if (typeof context.stage !== 'object') return null;
  if (Array.isArray(context.stage)) return null;

  return {
    context: {
      context: context.context as Record<string, unknown>,
      stage: context.stage as Record<string, unknown>,
    },
    currentStage: parsed.currentStage,
  };
};

export const normalizeToolCalls = (raw: unknown): ChatToolCall[] | undefined => {
  if (!Array.isArray(raw)) return undefined;

  const out: ChatToolCall[] = [];

  for (const item of raw) {
    if (!item || typeof item !== "object") continue;

    const entry = item as Record<string, unknown>;
    const id = typeof entry.id === "string" ? entry.id : "";
    const type = entry.type === "function" ? "function" : null;
    const fn = entry.function;

    if (!type || !fn || typeof fn !== "object") continue;

    const fnObj = fn as Record<string, unknown>;
    const name = typeof fnObj.name === "string" ? fnObj.name : "";
    const args = typeof fnObj.arguments === "string" ? fnObj.arguments : "";

    if (!id || !name) continue;

    out.push({
      function: {
        arguments: args,
        name,
      },
      id,
      type: "function",
    });
  }

  return out.length > 0 ? out : undefined;
};

const finalizeEnvelope = (
  content: string | null,
  contextsToSet: SetContextToolArguments[],
): StageEnvelope => {
  const trimmed = (content ?? "").trim();

  if (contextsToSet.length > 0) {
    return contextsToSet.map(toSet => setContextArgumentsToEnvelope(toSet));
  }

  if (trimmed) {
    const envelope = parseStageEnvelope(trimmed);
    if (envelope) return envelope;
  }

  const hint = trimmed ? trimmed.slice(0, 240) : "";

  return {
    output: trimmed
      ? `执行失败 最终回复不是有效 envelope 且未成功调用 set_context 工具: ${hint}`
      : "执行失败 最终回复为空 且未成功调用 set_context 工具",
    type: "result",
  };
};

const toolErrorContent = (message: string) =>
  JSON.stringify({
    error: message,
    ok: false,
  });

const toolOkContent = () =>
  JSON.stringify({
    ok: true,
  });

export const runStageSession = async (
  stageInput: StageSessionInput,
  messages: BootstrapMessage[],
  runner: StageRunner,
  options: StageSessionOptions = {},
): Promise<StageEnvelope> => {
  const maxBashCalls = options.maxBashCalls ?? 24;
  const maxTurns = options.maxTurns ?? 60;

  const toolsMd = await readFileUtf8(path.resolve(config.moduleDir, "Tools.md"));

  const payload = JSON.stringify(stageInput, null, 2);

  const stageMessages: ChatApiMessage[] = [
    ...toApiMessages(messages),
    {
      role: "user",
      content: `${toolsMd}\n\nInput:\n${payload}`,
    },
  ];

  let bashCalls = 0;
  let turns = 0;
  const contextsToSet: SetContextToolArguments[] = [];

  while (turns < maxTurns) {
    turns += 1;

    const { assistantMessage } = await runner.chatWithTools(stageMessages);
    stageMessages.push(assistantMessage);

    const toolCalls = assistantMessage.tool_calls || [];

    for (const call of toolCalls) {
      const name = call.function.name;
      const rawArgs = call.function.arguments ?? "";

      if (name === "run_bash") {
        const command = parseRunBashToolArguments(rawArgs);

        if (!command) {
          stageMessages.push({
            content: toolErrorContent("run_bash: invalid or empty command"),
            role: "tool",
            tool_call_id: call.id,
          });

          continue;
        }

        if (bashCalls >= maxBashCalls) {
          stageMessages.push({
            content: toolErrorContent(`run_bash: exceeded max calls (${maxBashCalls})`),
            role: "tool",
            tool_call_id: call.id,
          });

          continue;
        }

        bashCalls += 1;
        const commandResult = await runner.runCommand(command);
        if (config.debug) {
          process.stderr.write(`[DEBUG] [RUN_BASH] ${command}: ${commandResult}\n`);
        }

        stageMessages.push({
          content: commandResult,
          role: "tool",
          tool_call_id: call.id,
        });

        continue;
      }

      if (name === "rag") {
        const args = parseRagToolArguments(rawArgs);
        if (!args) {
          stageMessages.push({
            content: toolErrorContent("rag: invalid arguments"),
            role: "tool",
            tool_call_id: call.id,
          });

          continue;
        }

        return ragArgumentsToEnvelope(args);
      }

      if (name === "set_context") {
        const args = parseSetContextToolArguments(rawArgs);

        if (!args) {
          stageMessages.push({
            content: toolErrorContent("set_context: invalid arguments"),
            role: "tool",
            tool_call_id: call.id,
          });

          continue;
        }

        contextsToSet.push(args);
        stageMessages.push({
          content: toolOkContent(),
          role: "tool",
          tool_call_id: call.id,
        });

        continue;
      }

      stageMessages.push({
        content: toolErrorContent(`unknown tool: ${name}`),
        role: "tool",
        tool_call_id: call.id,
      });
    }

    if (toolCalls.length > 0) continue;

    return finalizeEnvelope(assistantMessage.content, contextsToSet);
  }

  return {
    output: `执行失败 stage对话轮次超过限制 ${maxTurns}`,
    type: "result",
  };
};
