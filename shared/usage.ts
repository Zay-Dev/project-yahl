import type { OpenAI } from "openai";

export type NormalizedUsage = {
  cacheHitTokens: number;
  cacheMissTokens: number;
  completionTokens: number;
  promptTokens: number;
  reasoningTokens: number;
  totalTokens: number;
};

const num = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

export const normalizeUsage = (usage: OpenAI.Completion['usage']): NormalizedUsage => {
  if (!usage || typeof usage !== "object" || Array.isArray(usage)) {
    return {
      cacheHitTokens: 0,
      cacheMissTokens: 0,
      completionTokens: 0,
      promptTokens: 0,
      reasoningTokens: 0,
      totalTokens: 0,
    };
  }

  const promptTokens = num(usage.prompt_tokens);
  const completionTokens = num(usage.completion_tokens);
  const totalTokens = num(usage.total_tokens) || promptTokens + completionTokens;

  let cacheHitTokens = 0;
  let cacheMissTokens = 0;

  if (usage.prompt_tokens_details?.cached_tokens) {
    cacheHitTokens = usage.prompt_tokens_details.cached_tokens;
    cacheMissTokens = usage.prompt_tokens - cacheHitTokens;
  } else if (!cacheHitTokens && !cacheMissTokens && promptTokens > 0) {
    cacheMissTokens = promptTokens;
  }

  const reasoningTokens = usage.completion_tokens_details?.reasoning_tokens || 0;

  return {
    cacheHitTokens,
    cacheMissTokens,
    completionTokens,
    promptTokens,
    reasoningTokens,
    totalTokens,
  };
};
