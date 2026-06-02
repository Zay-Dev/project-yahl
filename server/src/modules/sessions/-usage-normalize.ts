import type { TTokenTotals } from './-types';

const num = (value: unknown) =>
  (typeof value === 'number' && Number.isFinite(value) ? value : 0);

export const normalizeUsageToTokenTotals = (usage: unknown): TTokenTotals | null => {
  if (!usage || typeof usage !== 'object' || Array.isArray(usage)) {
    return null;
  }

  const record = usage as Record<string, unknown>;
  const promptTokens = num(record.prompt_tokens);
  const completionTokens = num(record.completion_tokens);
  const totalTokens = num(record.total_tokens) || promptTokens + completionTokens;

  if (promptTokens === 0 && completionTokens === 0 && totalTokens === 0) {
    return null;
  }

  let cacheHitTokens = 0;
  let cacheMissTokens = 0;

  const promptDetails = record.prompt_tokens_details;

  if (promptDetails && typeof promptDetails === 'object' && !Array.isArray(promptDetails)) {
    const cached = num((promptDetails as Record<string, unknown>).cached_tokens);

    if (cached > 0) {
      cacheHitTokens = cached;
      cacheMissTokens = promptTokens - cacheHitTokens;
    }
  }

  if (!cacheHitTokens && !cacheMissTokens && promptTokens > 0) {
    cacheMissTokens = promptTokens;
  }

  const completionDetails = record.completion_tokens_details;
  let reasoningTokens = 0;

  if (completionDetails && typeof completionDetails === 'object' && !Array.isArray(completionDetails)) {
    reasoningTokens = num((completionDetails as Record<string, unknown>).reasoning_tokens);
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
