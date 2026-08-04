import { Middlewares } from '@omni-infra/express';

import type { TResponseKnowledgeManagerInstruction } from '../-api-types';
import { fetchMastermindJson } from '../-mastermind-client';

type TMastermindInstructionResponse = {
  data?: { text?: string };
  ok?: boolean;
};

export const getKnowledgeManagerInstruction = [
  Middlewares.Chainable
    .next(async (express) => {
      const result = await fetchMastermindJson<TMastermindInstructionResponse>(
        '/v1/internal/knowledges/manager-instruction',
      );

      express.respondOne<TResponseKnowledgeManagerInstruction>({
        text: result.data?.text ?? '',
      });
    })
    .toMiddleware(),
];
