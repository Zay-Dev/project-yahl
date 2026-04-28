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
  response?: {
    durationMs: number;
    reasoning: string | null;
    reply: string | null;
    toolCalls?: ChatToolCall[];
  };
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
  response?: UsageEmitPayload["response"],
) => {
  if (!meta || !usageEmitter) return;

  usageEmitter({
    model: config.model,
    response,
    requestId: meta.requestId,
    sessionId: meta.sessionId,
    thinkingMode: config.thinkingMode,
    usage: normalizeUsage(raw),
  });
};

const getReasoningText = (message: unknown): string | null => {
  if (!message || typeof message !== "object") return null;

  const reasoningValue = (message as Record<string, unknown>).reasoning_content;
  if (typeof reasoningValue === "string" || reasoningValue === null) {
    return reasoningValue;
  }

  return null;
};

export const chat = async (
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  meta?: { requestId: string; sessionId: string },
) => {
  const start = Date.now();
  const response = await client.chat.completions.create({
    messages: messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    model: config.model,
    stream: false,
    ...toThinkingPayload(),
  } as any);
  const durationMs = Date.now() - start;
  const message = response.choices?.[0]?.message || null;

  emitUsage(meta, (response as { usage?: unknown }).usage, {
    durationMs,
    reasoning: getReasoningText(message),
    reply: getContentText(message?.content),
  });

  return getContentText(response.choices?.[0]?.message?.content) || "";
};

export const chatWithTools = async (
  messages: ChatApiMessage[],
  meta?: { requestId: string; sessionId: string },
): Promise<{
  assistantMessage: ChatAssistantMessage;
}> => {
  const start = Date.now();
  const response = await client.chat.completions.create({
    messages: asApiMessages(messages),
    model: config.model,
    stream: false,
    tool_choice: "auto",
    tools: STAGE_TOOLS as OpenAI.Chat.Completions.ChatCompletionTool[],
    ...toThinkingPayload(),
  } as any);
  const durationMs = Date.now() - start;
  const message = response.choices?.[0]?.message || null;

  if (!message) {
    throw new Error("LLM API returned no message");
  }

  if (config.debug) {
    process.stderr.write(`[DEBUG] [REPLY] ${JSON.stringify(message, null, 2)}\n`);
  }

  const reasoning_content = getReasoningText(message);
  const tool_calls = normalizeToolCalls(message.tool_calls);

  emitUsage(meta, (response as { usage?: unknown }).usage, {
    durationMs,
    reasoning: reasoning_content,
    reply: getContentText(message.content),
    toolCalls: tool_calls,
  });

  return {
    assistantMessage: {
      content: getContentText(message.content),
      reasoning_content,
      role: "assistant",
      tool_calls,
    },
  };
};
