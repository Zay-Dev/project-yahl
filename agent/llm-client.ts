import OpenAI from "openai";

import config from "./config";

import {
  STAGE_TOOLS,
  type ChatApiMessage,
  type ChatAssistantMessage,
  type ChatToolCall,
} from "../shared/stage-tools";

import { normalizeUsage, type NormalizedUsage } from "../shared/usage";

const normalizeToolCalls = (raw: unknown): ChatToolCall[] | undefined => {
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
    const args = typeof fnObj.arguments === "string" ? fnObj.arguments : JSON.stringify(fnObj.arguments || {});

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

const buildFetch = () => {
  if (config.apiKey) return fetch;

  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers || {});
    headers.delete("authorization");

    return fetch(input, {
      ...init,
      headers,
    });
  };
};

const client = new OpenAI({
  apiKey: config.apiKey || "sk-no-auth-required",
  baseURL: config.apiBaseUrl,
  fetch: buildFetch(),
});

const asApiMessages = (messages: ChatApiMessage[]) => messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[];

const toThinkingPayload = () =>
  config.thinkingMode
    ? {
      thinking: {
        type: "enabled",
      },
    }
    : undefined;

const getContentText = (content: unknown): string | null => {
  if (typeof content === "string") return content.trim();
  return null;
};

export type UsageEmitPayload = {
  model: string;
  requestId: string;
  sessionId: string;
  thinkingMode: boolean;
  usage: NormalizedUsage;
};

let usageEmitter: ((payload: UsageEmitPayload) => void) | null = null;

export const setUsageEmitter = (fn: ((payload: UsageEmitPayload) => void) | null) => {
  usageEmitter = fn;
};

const emitUsage = (
  meta: { requestId: string; sessionId: string } | undefined,
  raw: unknown,
) => {
  if (!meta || !usageEmitter) return;

  usageEmitter({
    model: config.model,
    requestId: meta.requestId,
    sessionId: meta.sessionId,
    thinkingMode: config.thinkingMode,
    usage: normalizeUsage(raw),
  });
};

export const chat = async (
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  meta?: { requestId: string; sessionId: string },
) => {
  const response = await client.chat.completions.create({
    messages: messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    model: config.model,
    stream: false,
    ...toThinkingPayload(),
  } as any);

  emitUsage(meta, (response as { usage?: unknown }).usage);

  return getContentText(response.choices?.[0]?.message?.content) || "";
};

export const chatWithTools = async (
  messages: ChatApiMessage[],
  meta?: { requestId: string; sessionId: string },
): Promise<{
  assistantMessage: ChatAssistantMessage;
}> => {
  const response = await client.chat.completions.create({
    messages: asApiMessages(messages),
    model: config.model,
    stream: false,
    tool_choice: "auto",
    tools: STAGE_TOOLS as OpenAI.Chat.Completions.ChatCompletionTool[],
    ...toThinkingPayload(),
  } as any);

  emitUsage(meta, (response as { usage?: unknown }).usage);

  const message = response.choices?.[0]?.message || null;
  if (!message) {
    throw new Error("LLM API returned no message");
  }

  if (config.debug) {
    process.stderr.write(`[DEBUG] [REPLY] ${JSON.stringify(message, null, 2)}\n`);
  }

  const reasoningValue = (message as any).reasoning_content;
  const reasoning_content =
    typeof reasoningValue === "string" || reasoningValue === null
      ? reasoningValue
      : null;

  return {
    assistantMessage: {
      content: getContentText(message.content),
      reasoning_content,
      role: "assistant",
      tool_calls: normalizeToolCalls(message.tool_calls),
    },
  };
};
