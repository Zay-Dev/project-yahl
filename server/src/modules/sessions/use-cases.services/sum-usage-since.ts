import { Queries } from '@omni-infra/mongoose';

import { modelModelResponse } from '../models';

export type TSumUsageSinceInput = {
  since: Date;
};

export type TSumUsageSinceResult = {
  completionTokens: number;
  promptTokens: number;
  since: string;
  totalTokens: number;
};

const finite = (value: unknown) => {
  const parsed = typeof value === 'number' ? value : Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
};

const billedTokens = (usage: Record<string, unknown>) => {
  if (typeof usage.total_tokens === 'number' && Number.isFinite(usage.total_tokens)) {
    return usage.total_tokens;
  }

  return finite(usage.prompt_tokens ?? usage.input_tokens)
    + finite(usage.completion_tokens ?? usage.output_tokens);
};

export const sumUsageSince = async ({ since }: TSumUsageSinceInput): Promise<TSumUsageSinceResult> => {
  const rows = await Queries.queryBy(modelModelResponse, {
    createdAt: { $gte: since },
  });

  let promptTokens = 0;
  let completionTokens = 0;
  let totalTokens = 0;

  for (const row of rows) {
    const usage = (row.response as { usage?: Record<string, unknown> } | undefined)?.usage;

    if (!usage || typeof usage !== 'object') {
      continue;
    }

    promptTokens += finite(usage.prompt_tokens ?? usage.input_tokens);
    completionTokens += finite(usage.completion_tokens ?? usage.output_tokens);
    totalTokens += billedTokens(usage);
  }

  return {
    completionTokens,
    promptTokens,
    since: since.toISOString(),
    totalTokens,
  };
};
