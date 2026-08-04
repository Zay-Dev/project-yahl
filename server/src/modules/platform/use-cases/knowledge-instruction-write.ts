import Joi from 'joi';

import { Middlewares } from '@omni-infra/express';

import type {
  TRequestPutKnowledgeManagerInstructionBody,
  TResponseKnowledgeManagerInstruction,
} from '../-api-types';
import { fetchMastermindJson } from '../-mastermind-client';

const bodySchema = Joi.object<TRequestPutKnowledgeManagerInstructionBody>({
  text: Joi.string().allow('').required(),
});

type TMastermindInstructionResponse = {
  data?: { text?: string };
  ok?: boolean;
};

export const putKnowledgeManagerInstruction = [
  Middlewares.Chainable
    .validate(({ req }) => ({
      body: joi.getValidatedOrThrow(bodySchema, req.body),
    }))
    .next(async (express, { body }) => {
      const result = await fetchMastermindJson<TMastermindInstructionResponse>(
        '/v1/internal/knowledges/manager-instruction',
        {
          body: JSON.stringify({ text: body.text }),
          method: 'PUT',
        },
      );

      express.respondOne<TResponseKnowledgeManagerInstruction>({
        text: result.data?.text ?? body.text,
      });
    })
    .toMiddleware(),
];
