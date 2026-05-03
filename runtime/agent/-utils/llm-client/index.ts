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
  durationMs: number;
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

export const chatWithTools = async (
  messages: ChatApiMessage[],
): Promise<ChatAssistantMessage> => {
  return await _chat(messages, { allowTools: true });
};

const _chat = async (
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  options: {
    allowTools?: true;
  } = {},
) => {
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
    
    const message = response.choices?.[0]?.message || null;
  
    if (!message) {
      throw new Error("LLM API returned no message");
    }
  
    const content = Utils.getContentText(message.content);
    const reasoning_content = Utils.getReasoningText(message);
    const tool_calls = Utils.normalizeToolCalls(message.tool_calls);
  
    return {
      content,
      response,
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