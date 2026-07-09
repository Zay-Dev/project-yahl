import { Middlewares } from '@omni-infra/express';

import type { TResponseTopicPolicies } from '../-api-types';
import { fetchMastermindJson } from '../-mastermind-client';

type TMastermindTopicPoliciesResponse = {
  data?: { items?: TResponseTopicPolicies['items'] };
  items?: TResponseTopicPolicies['items'];
  ok?: boolean;
};

export const listKnowledgePolicies = [
  Middlewares.Chainable
    .next(async (express) => {
      const result = await fetchMastermindJson<TMastermindTopicPoliciesResponse>(
        '/v1/internal/knowledges/topic-policies',
      );

      const items = result.data?.items ?? [];

      express.respondOne<TResponseTopicPolicies>({ items });
    })
    .toMiddleware(),
];
