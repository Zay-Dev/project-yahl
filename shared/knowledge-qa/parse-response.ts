import { knowledgeQaReviewResponseSchema } from './schemas.js';

import type { TKnowledgeQaReviewResponse } from './types.js';

export const parseKnowledgeQaReviewResponse = (text: string): TKnowledgeQaReviewResponse => {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(jsonMatch?.[0] ?? text) as unknown;
  const validated = knowledgeQaReviewResponseSchema.parse(parsed);

  return validated;
};
