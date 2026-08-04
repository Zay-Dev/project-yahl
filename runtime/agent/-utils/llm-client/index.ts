import type {
  ChatApiMessage,
  ChatAssistantMessage,
} from '@/shared/stage-tools';

import OpenAI from "openai";
import config from "@/agent/config";

import { STAGE_TOOLS } from "@/shared/stage-tools";

import { effectiveApiKey, normalizeLlmBaseUrl, openAiFetch } from "../llm-transport";

import * as Utils from "./-utils";

export type TStagehandProxyCompletionInput = {
  apiBaseUrl?: string;
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
  model?: string;
  modelOverride?: string;
  temperature?: number;
  tool_choice?: OpenAI.Chat.Completions.ChatCompletionToolChoiceOption;
  tools?: OpenAI.Chat.Completions.ChatCompletionTool[];
};

export const resolveNestedModelForStagehandProxy = (
  requested?: string,
  override?: string,
) => {
  const raw = (override?.trim() || requested || config.model).trim();

  if (!raw) return config.model;

  const withoutProvider = raw.includes("/") ? raw.slice(raw.indexOf("/") + 1) : raw;

  return withoutProvider || config.model;
};

export const buildStagehandProxyLlmCreateParams = (
  input: TStagehandProxyCompletionInput,
) => ({
  messages: input.messages,
  model: resolveNestedModelForStagehandProxy(input.model, input.modelOverride),
  stream: false as const,
  thinking: { type: "disabled" as const },
  ...(input.temperature !== undefined ? { temperature: input.temperature } : {}),
  ...(input.tools?.length
    ? {
        tool_choice: input.tool_choice ?? "auto",
        tools: input.tools,
      }
    : {}),
});

export const chatWithTools = async (
  messages: ChatApiMessage[],
  options?: { temperature?: number },
): Promise<ChatAssistantMessage> => {
  return await _chat(messages, { allowTools: true, ...options });
};

export const chatCompletionForStagehandProxy = async (
  input: TStagehandProxyCompletionInput,
): Promise<OpenAI.Chat.Completions.ChatCompletion> => {
  const client = input.apiBaseUrl
    ? new OpenAI({
        apiKey: effectiveApiKey(config.apiKey),
        baseURL: normalizeLlmBaseUrl(input.apiBaseUrl),
        fetch: openAiFetch(config.apiKey),
      })
    : _client;

  const response = await client.chat.completions.create(
    buildStagehandProxyLlmCreateParams(input) as any,
  );

  if (!response.choices?.[0]?.message) {
    throw new Error("LLM API returned no message");
  }

  return response;
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
