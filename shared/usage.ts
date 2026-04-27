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

export const normalizeUsage = (raw: unknown): NormalizedUsage => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      cacheHitTokens: 0,
      cacheMissTokens: 0,
      completionTokens: 0,
      promptTokens: 0,
      reasoningTokens: 0,
      totalTokens: 0,
    };
  }

  const u = raw as Record<string, unknown>;
  const promptTokens = num(u.prompt_tokens);
  const completionTokens = num(u.completion_tokens);
  const totalTokens = num(u.total_tokens) || promptTokens + completionTokens;
  let cacheHitTokens = num(u.prompt_cache_hit_tokens);
  let cacheMissTokens = num(u.prompt_cache_miss_tokens);

  if (!cacheHitTokens && !cacheMissTokens && promptTokens > 0) {
    cacheMissTokens = promptTokens;
  }

  const details = u.completion_tokens_details;
  let reasoningTokens = 0;

  if (details && typeof details === "object" && !Array.isArray(details)) {
    reasoningTokens = num((details as Record<string, unknown>).reasoning_tokens);
  }

  return {
    cacheHitTokens,
    cacheMissTokens,
    completionTokens,
    promptTokens,
    reasoningTokens,
    totalTokens,
  };
};
