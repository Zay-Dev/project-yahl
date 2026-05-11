import config from "./config";

import path from "path";

import {
  parseStageEnvelope,
  type RenderA2uiPlanToolCallEnvelope,
  type SetContextToolCallEnvelope,
  type StageEnvelope,
  type StageSessionInput,
} from "../shared/stage-contract";

import {
  type ChatApiMessage,
  type ChatAssistantMessage,
  type ChatToolCall,
  parseAskUserToolArguments,
  parseRagToolArguments,
  parseRenderA2uiPlanToolArgumentsDetailed,
  parseRunBashToolArguments,
  parseSetContextToolArguments,
  askUserArgumentsToEnvelope,
  ragArgumentsToEnvelope,
  renderA2uiPlanArgumentsToEnvelope,
  setContextArgumentsToEnvelope,
} from "../shared/stage-tools";
import { buildA2uiTranslatorSystemMessage, buildA2uiTranslatorUserMessage } from "../orchestrator/-utils/a2ui-plan-translator";

import { readFileUtf8 } from "./-utils/prompts";

type BootstrapMessage = {
  content: string;
  role: "system" | "user" | "assistant";
};

type StageRunner = {
  runCommand: (command: string) => Promise<string>;

  chatWithTools: (
    messages: ChatApiMessage[],
    options?: { temperature?: number },
  ) => Promise<ChatAssistantMessage>;
};

type StageSessionOptions = {
  maxBashCalls?: number;
  maxTurns?: number;
};

const a2uiStagePattern = /\/a2ui\(\s*([a-zA-Z0-9_.-]+)\s*\)/;

const summarizeNodeShape = (value: unknown): unknown => {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (Array.isArray(value)) {
    if (!value.length) return [];
    return [{ item: summarizeNodeShape(value[0]) }];
  }
  if (typeof value === "object") {
    const input = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    Object.keys(input)
      .sort()
      .slice(0, 30)
      .forEach((key) => {
        out[key] = summarizeNodeShape(input[key]);
      });
    return out;
  }
  return typeof value;
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

  const types = context.types;
  const typesRecord =
    types && typeof types === "object" && !Array.isArray(types)
      ? (types as Record<string, unknown>)
      : {};

  const temperatureRaw = parsed.temperature;
  const temperature =
    typeof temperatureRaw === "number" && Number.isFinite(temperatureRaw) ? temperatureRaw : undefined;

  return {
    context: {
      context: context.context as Record<string, unknown>,
      stage: context.stage as Record<string, unknown>,
      types: typesRecord,
    },
    currentStage: parsed.currentStage,
    ...(temperature === undefined ? {} : { temperature }),
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
  toolEnvelopes: Array<RenderA2uiPlanToolCallEnvelope | SetContextToolCallEnvelope>,
): StageEnvelope => {
  const trimmed = (content ?? "").trim();

  if (toolEnvelopes.length > 0) {
    return toolEnvelopes;
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

  const toolsMd = await readFileUtf8(path.resolve(config.runtimeRoot, "Tools.md"));

  const payload = JSON.stringify(stageInput, null, 2);
  const a2uiMatch = stageInput.currentStage.match(a2uiStagePattern);
  const a2uiKey = a2uiMatch?.[1]?.trim();
  const a2uiRootData = a2uiKey ? stageInput.context.context[a2uiKey] : undefined;
  const a2uiSchemaSummary =
    a2uiRootData === undefined ? undefined : JSON.stringify(summarizeNodeShape(a2uiRootData));
  const a2uiTranslatorMessages: ChatApiMessage[] =
    a2uiKey
      ? [
        {
          content: buildA2uiTranslatorSystemMessage(),
          role: "system",
        },
        {
          content: buildA2uiTranslatorUserMessage({
            dataRef: { key: a2uiKey, scope: "global" },
            schemaSummary: a2uiSchemaSummary,
          }),
          role: "system",
        },
      ]
      : [];

  const stageMessages: ChatApiMessage[] = [
    ...toApiMessages(messages),
    ...a2uiTranslatorMessages,
    {
      role: "user",
      // content: `${toolsMd}\n\nInput:\n${payload}`,
      content: `\n\nInput:\n${payload}`
    },
  ];

  let bashCalls = 0;
  let turns = 0;
  const toolEnvelopes: Array<RenderA2uiPlanToolCallEnvelope | SetContextToolCallEnvelope> = [];
  const invalidRenderArgsAttempts = new Map<string, number>();
  const maxSameInvalidRenderAttempts = 3;

  while (turns < maxTurns) {
    turns += 1;

    const chatOpts =
      stageInput.temperature === undefined ? undefined : { temperature: stageInput.temperature };
    const assistantMessage = await runner.chatWithTools(stageMessages, chatOpts);
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
          console.log(`[DEBUG] [RUN_BASH] ${command}: ${commandResult}\n`);
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

      if (name === "ask_user") {
        const args = parseAskUserToolArguments(rawArgs);
        if (!args) {
          stageMessages.push({
            content: toolErrorContent("ask_user: invalid arguments"),
            role: "tool",
            tool_call_id: call.id,
          });
          continue;
        }
        return askUserArgumentsToEnvelope(args);
      }

      if (name === "render_a2ui_plan") {
        const parsed = parseRenderA2uiPlanToolArgumentsDetailed(rawArgs);
        if (!parsed.ok) {
          const signature = `${parsed.issue.code}:${rawArgs}`;
          const attempts = (invalidRenderArgsAttempts.get(signature) ?? 0) + 1;
          invalidRenderArgsAttempts.set(signature, attempts);
          stageMessages.push({
            content: toolErrorContent(
              `render_a2ui_plan: ${parsed.issue.code}: ${parsed.issue.message}`,
            ),
            role: "tool",
            tool_call_id: call.id,
          });

          if (attempts >= maxSameInvalidRenderAttempts) {
            return {
              output:
                `执行失败 render_a2ui_plan repeated invalid arguments (${parsed.issue.code}) ` +
                `${attempts} times: ${parsed.issue.message}`,
              type: "result",
            };
          }

          continue;
        }
        toolEnvelopes.push(renderA2uiPlanArgumentsToEnvelope(parsed.arguments));
        stageMessages.push({
          content: toolOkContent(),
          role: "tool",
          tool_call_id: call.id,
        });
        continue;
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

        toolEnvelopes.push(setContextArgumentsToEnvelope(args));
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

    return finalizeEnvelope(assistantMessage.content, toolEnvelopes);
  }

  return {
    output: `执行失败 stage对话轮次超过限制 ${maxTurns}`,
    type: "result",
  };
};
