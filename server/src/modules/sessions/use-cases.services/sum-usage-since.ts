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

export const sumUsageSince = async ({ since }: TSumUsageSinceInput): Promise<TSumUsageSinceResult> => {
  const rows = await Queries.queryBy(modelModelResponse, {
    createdAt: { $gte: since },
  });

  let promptTokens = 0;
  let completionTokens = 0;

  for (const row of rows) {
    const usage = (row.response as { usage?: Record<string, unknown> } | undefined)?.usage;

    if (!usage || typeof usage !== 'object') {
      continue;
    }

    promptTokens += Number(usage.prompt_tokens ?? usage.input_tokens ?? 0);
    completionTokens += Number(usage.completion_tokens ?? usage.output_tokens ?? 0);
  }

  return {
    completionTokens,
    promptTokens,
    since: since.toISOString(),
    totalTokens: promptTokens + completionTokens,
  };
};
