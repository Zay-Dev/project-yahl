import type {
  ChatApiMessage,
  ChatAssistantMessage,
} from '@/shared/stage-tools';

import OpenAI from "openai";
import config from "@/agent/config";

import { STAGE_TOOLS } from "@/shared/stage-tools";

import { effectiveApiKey, openAiFetch } from "../llm-transport";

import * as Utils from "./-utils";

export const chatWithTools = async (
  messages: ChatApiMessage[],
  options?: { temperature?: number },
): Promise<ChatAssistantMessage> => {
  return await _chat(messages, { allowTools: true, ...options });
};

const _chat = async (
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  options: {
    allowTools?: true;
    temperature?: number;
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

      ...options.temperature !== undefined && { temperature: options.temperature },

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
  apiKey: effectiveApiKey(config.apiKey),
  baseURL: config.apiBaseUrl,
  fetch: openAiFetch(config.apiKey),
});
