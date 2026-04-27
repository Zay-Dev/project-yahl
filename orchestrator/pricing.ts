import type { ModelPrice } from "../shared/pricing";

import type { NormalizedUsage } from "../shared/usage";

const flash: ModelPrice = {
  inputCacheHit: 0.0028,
  inputCacheMiss: 0.14,
  output: 0.28,
};

const pro: ModelPrice = {
  inputCacheHit: 0.003625,
  inputCacheMiss: 0.435,
  output: 0.87,
};

const MODEL_PRICES = new Map<string, ModelPrice>([
  ["deepseek-v4-flash", flash],
  ["deepseek-v4-pro", pro],
  ["deepseek-chat", flash],
  ["deepseek-reasoner", flash],
]);

const warnedUnknown = new Set<string>();

const resolvePrice = (model: string): ModelPrice | null => MODEL_PRICES.get(model.trim()) ?? null;

export const computeCost = (model: string, usage: NormalizedUsage): number => {
  const price = resolvePrice(model);

  if (!price) {
    if (!warnedUnknown.has(model)) {
      warnedUnknown.add(model);
      process.stderr.write(
        `[WARN] unknown model pricing: ${model}; using deepseek-v4-flash cache-miss input rate for all prompt tokens\n`,
      );
    }

    const fb = flash;

    return (
      usage.promptTokens * fb.inputCacheMiss +
      usage.completionTokens * fb.output
    ) / 1_000_000;
  }

  return (
    usage.cacheHitTokens * price.inputCacheHit +
    usage.cacheMissTokens * price.inputCacheMiss +
    usage.completionTokens * price.output
  ) / 1_000_000;
};
