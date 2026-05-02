import type { NormalizedUsage } from '@/shared/usage';

import type {
  ChatToolCall,
  ChatApiMessage,
  ChatAssistantMessage,
} from '@/shared/stage-tools';

import OpenAI from "openai";
import config from "@/agent/config";

import { normalizeUsage } from "@/shared/usage";
import { STAGE_TOOLS } from "@/shared/stage-tools";

import * as Utils from "./-utils";

type TMeta = {
  requestId: string;
  sessionId: string;
};

type UsageEmitPayload = {
  chatMessages?: { content?: unknown; role: string; toolCallIndex?: number; usageDelta?: unknown }[];
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

export const getEmitter = () => usageEmitter;

export const setUsageEmitter = (fn: ((payload: UsageEmitPayload) => void) | null) => {
  usageEmitter = fn;
};

export const chat = async (
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  meta?: TMeta,
) => {
  const { content } = await _chat(messages, meta);

  return content || "";
};

export const chatWithTools = async (
  messages: ChatApiMessage[],
  meta?: TMeta,
): Promise<ChatAssistantMessage> => {
  return await _chat(messages, meta, { allowTools: true });
};

const _chat = async (
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  meta?: TMeta,
  options: {
    allowTools?: true;
  } = {},
) => {
  const start = Date.now();
  try {
    const response = await _client.chat.completions.create({
      messages,
      model: config.model,
      stream: false,
  
      ...options.allowTools && {
        tool_choice: "auto",
        tools: STAGE_TOOLS as OpenAI.Chat.Completions.ChatCompletionTool[],
      },
  
      thinking: { type: config.thinkingMode ? "enabled" : "disabled" },
    } as any);
    
    const durationMs = Date.now() - start;
    const message = response.choices?.[0]?.message || null;
  
    if (!message) {
      throw new Error("LLM API returned no message");
    }
  
    const content = Utils.getContentText(message.content);
    const reasoning_content = Utils.getReasoningText(message);
    const tool_calls = Utils.normalizeToolCalls(message.tool_calls);
  
    if (!!meta && !!usageEmitter) {
      const responsePayload = {
        durationMs,
        reasoning: reasoning_content ?? null,
        reply: content ?? null,
        toolCalls: tool_calls,
      };
  
      usageEmitter({
        chatMessages: [
          {
            content: content ?? "",
            role: "assistant",
          },
        ],
        model: config.model,
        requestId: meta.requestId,
        sessionId: meta.sessionId,

        response: responsePayload,
        thinkingMode: config.thinkingMode,
        usage: normalizeUsage(response.usage),
      });
    }
  
    return {
      content,
      tool_calls,
      reasoning_content,
      role: "assistant" as const,
    };
  } catch (error) {
    console.error(error);
    throw error;
  }
};

const _client = new OpenAI({
  apiKey: config.apiKey || "sk-no-auth-required",
  baseURL: config.apiBaseUrl,

  fetch: (() => {
    if (config.apiKey) return fetch;

    return async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers || {});
      headers.delete("authorization");

      return fetch(input, {
        ...init,
        headers,
      });
    };
  })(),
});