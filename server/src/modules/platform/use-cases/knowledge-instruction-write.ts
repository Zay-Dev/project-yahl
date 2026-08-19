import Joi from 'joi';

import { Middlewares } from '@omni-infra/express';

import type {
  TRequestPutKnowledgeManagerInstructionBody,
  TResponseKnowledgeManagerInstruction,
} from '../-api-types';
import {
  assertPlatformApprovalToken,
  writeKnowledgeManagerInstructionText,
} from '../-knowledge-instruction';

const bodySchema = Joi.object<TRequestPutKnowledgeManagerInstructionBody>({
  text: Joi.string().allow('').required(),
});

export const putKnowledgeManagerInstruction = [
  Middlewares.Chainable
    .validate(({ req }) => ({
      body: joi.getValidatedOrThrow(bodySchema, req.body),
    }))
    .next(async (express, { body }) => {
      assertPlatformApprovalToken(express.req.headers['x-approval-token']);
      await writeKnowledgeManagerInstructionText(body.text);

      express.respondOne<TResponseKnowledgeManagerInstruction>({
        text: body.text,
      });
    })
    .toMiddleware(),
];
