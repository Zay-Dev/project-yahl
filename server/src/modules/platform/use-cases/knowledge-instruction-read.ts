import { Middlewares } from '@omni-infra/express';

import type { TResponseKnowledgeManagerInstruction } from '../-api-types';
import { readKnowledgeManagerInstructionText } from '../-knowledge-instruction';

export const getKnowledgeManagerInstruction = [
  Middlewares.Chainable
    .next(async (express) => {
      const text = await readKnowledgeManagerInstructionText();

      express.respondOne<TResponseKnowledgeManagerInstruction>({ text });
    })
    .toMiddleware(),
];
