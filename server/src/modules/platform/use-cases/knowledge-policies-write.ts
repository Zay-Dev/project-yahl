import Joi from 'joi';

import { Middlewares } from '@omni-infra/express';

import type {
  TRequestKnowledgePolicyParams,
  TRequestPatchKnowledgePolicyBody,
  TResponseTopicPolicy,
} from '../-api-types';
import { fetchMastermindJson } from '../-mastermind-client';

const paramsSchema = Joi.object<TRequestKnowledgePolicyParams>({
  slug: Joi.string().trim().required(),
});

const patchBodySchema = Joi.object<TRequestPatchKnowledgePolicyBody>({
  enabled: Joi.boolean().optional(),
  interval: Joi.string().valid('daily', 'weekly', 'biweekly', 'monthly').allow(null).optional(),
  lastRunAt: Joi.string().allow(null).optional(),
  lastRunSessionId: Joi.string().allow(null).optional(),
  lastRunStatus: Joi.string().valid('success', 'failed', 'skipped').allow(null).optional(),
  scopes: Joi.array().items(
    Joi.string().valid('studies', 'facts', 'synthesis', 'summary'),
  ).optional(),
});

type TMastermindPatchResponse = {
  data?: TResponseTopicPolicy;
  ok?: boolean;
};

export const patchKnowledgePolicy = [
  Middlewares.Chainable
    .validate(({ req }) => ({
      body: joi.getValidatedOrThrow(patchBodySchema, req.body),
      params: joi.getValidatedOrThrow(paramsSchema, req.params),
    }))
    .next(async (express, { body, params }) => {
      const result = await fetchMastermindJson<TMastermindPatchResponse>(
        `/v1/internal/knowledges/topic-policies/${encodeURIComponent(params.slug)}`,
        {
          body: JSON.stringify(body),
          method: 'PATCH',
        },
      );

      if (!result.ok || !result.data) {
        throw new Error('patch-topic-policy failed');
      }

      express.respondOne<TResponseTopicPolicy>(result.data);
    })
    .toMiddleware(),
];
