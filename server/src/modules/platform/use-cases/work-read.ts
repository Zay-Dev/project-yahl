import Joi from 'joi';

import { Middlewares } from '@omni-infra/express';
import { Queries } from '@omni-infra/mongoose';

import type { TResponsePendingWork } from '../-types';
import { modelPlatformProposal } from '../models';

export const listPendingWork = [
  Middlewares.Chainable
    .next(async (express) => {
      const items = await Queries.queryBy(modelPlatformProposal, {
        done: false,
        status: 'approved',
      });

      express.respondOne<TResponsePendingWork>({
        items: items.map((item) => ({
          approved: item.status === 'approved',
          approvedAt: item.approvedAt?.toISOString(),
          done: item.done,
          id: item.proposalId,
          kind: item.kind,
          payload: item.payload as Record<string, unknown>,
        })),
      });
    })
    .toMiddleware(),
];

export const markNotificationDone = [
  Middlewares.Chainable
    .validate(({ req }) => ({
      params: joi.getValidatedOrThrow(Joi.object({
        id: Joi.string().required(),
      }), req.params),
    }))
    .next(async (express, { params }) => {
      await modelPlatformProposal.updateOne(
        { kind: 'notification', proposalId: params.id },
        { $set: { done: true, doneAt: new Date() } },
      );

      express.respondOne({ id: params.id, ok: true });
    })
    .toMiddleware(),
];

export const markSettingDone = [
  Middlewares.Chainable
    .validate(({ req }) => ({
      params: joi.getValidatedOrThrow(Joi.object({
        id: Joi.string().required(),
      }), req.params),
    }))
    .next(async (express, { params }) => {
      await modelPlatformProposal.updateOne(
        { kind: 'setting', proposalId: params.id },
        { $set: { done: true, doneAt: new Date() } },
      );

      express.respondOne({ id: params.id, ok: true });
    })
    .toMiddleware(),
];

export const markKnowledgeTransferDone = [
  Middlewares.Chainable
    .validate(({ req }) => ({
      params: joi.getValidatedOrThrow(Joi.object({
        id: Joi.string().required(),
      }), req.params),
    }))
    .next(async (express, { params }) => {
      await modelPlatformProposal.updateOne(
        { kind: 'knowledge_transfer', proposalId: params.id, status: 'approved' },
        { $set: { done: true, doneAt: new Date() } },
      );

      express.respondOne({ id: params.id, ok: true });
    })
    .toMiddleware(),
];

export const applySettingProposal = [
  Middlewares.Chainable
    .validate(({ req }) => ({
      params: joi.getValidatedOrThrow(Joi.object({
        id: Joi.string().required(),
      }), req.params),
    }))
    .next(async (express, { params }) => {
      const doc = await Queries.hasExactOne(modelPlatformProposal, {
        kind: 'setting',
        proposalId: params.id,
        status: 'approved',
      });

      if (doc.done) {
        throw errors.badRequest('proposal already applied');
      }

      await modelPlatformProposal.updateOne(
        { proposalId: params.id },
        {
          $set: {
            done: true,
            doneAt: new Date(),
            'payload.appliedAt': new Date().toISOString(),
          },
        },
      );

      express.respondOne({ id: params.id, ok: true });
    })
    .toMiddleware(),
];
