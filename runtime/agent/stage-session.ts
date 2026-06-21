import config from "./config";

import type { TAskUserResumeFrom } from '@/shared/transports/-types';

import {
  parseStageEnvelope,
  type StageEnvelope,
  type StageSessionInput,
} from "@/shared/stage-contract";
import { validateYahlStage } from "@/shared/yahl-stage";

import {
  type ChatApiMessage,
  type ChatAssistantMessage,
  type ChatToolCall,
  parseBrowserToolArguments,
  parseMastermindToolArguments,
  parseRunBashToolArguments,
} from "@/shared/stage-tools";
import { callMastermindSkill } from "@/shared/mastermind-client";

import { closeStagehandSession, runBrowserCommand } from "./-browser/stagehand-session";
import { buildAskUserResumePrompt } from "./-utils/ask-user-resume-prompt";

type BootstrapMessage = {
  content: string;
  role: "system" | "user" | "assistant";
};

type StageRunner = {
  runCommand: (command: string) => Promise<string>;

  chatWithTools: (
    messages: ChatApiMessage[],
    options?: { temperature?: number },
  ) => Promise<ChatAssistantMessage[]>;
};

export type TLocalToolCallRecord = {
  call: ChatToolCall;
  resultContent: string;
};

type StageSessionOptions = {
  maxBashCalls?: number;
  maxTurns?: number;
  onLocalToolCall?: (record: TLocalToolCallRecord) => Promise<void>;
  resumeFrom?: TAskUserResumeFrom;
  resumeMessages?: ChatApiMessage[];
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
  if (!parsed.stage || typeof parsed.stage !== "object" || Array.isArray(parsed.stage)) return null;

  let stage;
  try {
    stage = validateYahlStage(parsed.stage);
  } catch {
    return null;
  }

  if (!parsed.context) return null;
  if (typeof parsed.context !== 'object') return null;
  if (Array.isArray(parsed.context)) return null;

  const context = parsed.context as Record<string, unknown>;

  if (!context.context) return null;
  if (typeof context.context !== 'object') return null;
  if (Array.isArray(context.context)) return null;

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
      context: new Map(Object.entries(context.context as Record<string, unknown>)),
      types: new Map(Object.entries(typesRecord)),
    },
    stage,
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

const finalizeEnvelope = (content: string | null): StageEnvelope => {
  const trimmed = (content ?? "").trim();

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

export const runStageSession = async (
  stageInput: StageSessionInput,
  messages: BootstrapMessage[],
  runner: StageRunner,
  options: StageSessionOptions = {},
): Promise<StageEnvelope> => {
  const maxBashCalls = options.maxBashCalls ?? 24;
  const maxTurns = options.maxTurns ?? 60;

  const askUserResumePrompt = options.resumeFrom
    ? buildAskUserResumePrompt(options.resumeFrom)
    : '';

  const pendingAskUser = stageInput.stage.askUser?.filter((entry) => entry.answer === undefined) ?? [];
  const askUserHint = pendingAskUser.length
    ? [
      'Registered askUser questions (use exact questionRef and title):',
      ...pendingAskUser.map((entry) => (
        `- questionRef: "${entry.id}", title: ${JSON.stringify(entry.question)}`
      )),
    ].join('\n')
    : '';

  const payload = JSON.stringify({
    ...stageInput,
    context: {
      context: Object.fromEntries(stageInput.context.context.entries()),
      types: Object.fromEntries(stageInput.context.types.entries()),
    },
  }, null, 2);

  const stageMessages: ChatApiMessage[] = [
    ...toApiMessages(messages),
    {
      role: "user",
      content: [
        askUserResumePrompt,
        askUserHint,
        `\n\nInput:\n${payload}`,
      ].filter(Boolean).join('\n'),
    },
    ...(options.resumeMessages ?? []),
  ];

  let bashCalls = 0;
  let browserCalls = 0;
  let turns = 0;

  try {
    while (turns < maxTurns) {
      turns += 1;

      const chatOpts =
        stageInput.temperature === undefined ? undefined : { temperature: stageInput.temperature };
      const assistantMessage = await runner.chatWithTools(stageMessages, chatOpts);
      stageMessages.push(...assistantMessage);

      const toolCalls = assistantMessage.flatMap((message) => message.tool_calls || []);

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

          await options.onLocalToolCall?.({ call, resultContent: commandResult });

          continue;
        }

        if (name === "browser") {
          const browserArgs = parseBrowserToolArguments(rawArgs);

          if (!browserArgs) {
            stageMessages.push({
              content: toolErrorContent("browser: invalid arguments"),
              role: "tool",
              tool_call_id: call.id,
            });

            continue;
          }

          browserCalls += 1;
          const browserResult = await runBrowserCommand(browserArgs);

          if (config.debug) {
            console.log(`[DEBUG] [BROWSER] ${browserArgs.mode}: ${JSON.stringify(browserResult)}\n`);
          }

          const browserContent = JSON.stringify(browserResult);

          stageMessages.push({
            content: browserContent,
            role: "tool",
            tool_call_id: call.id,
          });

          await options.onLocalToolCall?.({ call, resultContent: browserContent });

          continue;
        }

        if (name === "mastermind") {
          const mastermindArgs = parseMastermindToolArguments(rawArgs);

          if (!mastermindArgs) {
            stageMessages.push({
              content: toolErrorContent("mastermind: invalid arguments"),
              role: "tool",
              tool_call_id: call.id,
            });

            continue;
          }

          const mastermindResult = await callMastermindSkill(
            mastermindArgs.skill,
            mastermindArgs.args,
            config.cliOptions.sessionId,
          );

          const mastermindContent = JSON.stringify(mastermindResult);

          stageMessages.push({
            content: mastermindContent,
            role: "tool",
            tool_call_id: call.id,
          });

          await options.onLocalToolCall?.({ call, resultContent: mastermindContent });

          continue;
        }

        if (name === "set_context" || name === "ask_user") {
          continue;
        }

        stageMessages.push({
          content: toolErrorContent(`unknown tool: ${name}`),
          role: "tool",
          tool_call_id: call.id,
        });
      }

      if (toolCalls.length > 0) continue;

      return finalizeEnvelope(assistantMessage.at(-1)?.content || '');
    }

    return {
      output: `执行失败 stage对话轮次超过限制 ${maxTurns}`,
      type: "result",
    };
  } finally {
    if (browserCalls > 0) {
      await closeStagehandSession();
    }
  }
};
