import { randomUUID } from 'crypto';

import Joi from 'joi';

import { Middlewares } from '@omni-infra/express';
import { Queries } from '@omni-infra/mongoose';
import {
  parseEmailWhitelist,
  recipientMatchesEmailWhitelist,
} from '@project-yahl/shared/email/whitelist';
import {
  parseWhatsAppWhitelist,
  recipientMatchesWhatsAppWhitelist,
} from '@project-yahl/shared/whatsapp/whitelist';

import type {
  TRequestCreateNotificationProposal,
  TRequestCreateSettingProposal,
  TResponseProposalCreated,
} from '../-types';
import { modelPlatformProposal } from '../models';

const notificationBodySchema = Joi.object<TRequestCreateNotificationProposal>({
  body: Joi.string().required(),
  channel: Joi.string().valid('email', 'whatsapp').required(),
  direction: Joi.string().valid('to_user', 'on_behalf_of_user').required(),
  fromIdentity: Joi.string().optional(),
  orgId: Joi.string().optional(),
  orgUnitId: Joi.string().optional(),
  sessionId: Joi.string().optional(),
  taskRef: Joi.string().optional(),
  templateRef: Joi.string().optional(),
  to: Joi.string().required(),
  userId: Joi.string().optional(),
});

const settingBodySchema = Joi.object<TRequestCreateSettingProposal>({
  key: Joi.string().required(),
  orgId: Joi.string().optional(),
  orgUnitId: Joi.string().optional(),
  patch: Joi.object().required(),
  reason: Joi.string().optional(),
  userId: Joi.string().optional(),
});

const resolveNotificationStatus = (
  body: TRequestCreateNotificationProposal,
): 'approved' | 'pending' => {
  if (body.channel === 'email') {
    const whitelist = parseEmailWhitelist(process.env.EMAIL_WHITELIST);

    if (recipientMatchesEmailWhitelist(body.to, whitelist)) {
      return 'approved';
    }

    return 'pending';
  }

  if (body.channel === 'whatsapp') {
    const whitelist = parseWhatsAppWhitelist(process.env.WHATSAPP_WHITELIST);

    if (recipientMatchesWhatsAppWhitelist(body.to, whitelist)) {
      return 'approved';
    }
  }

  return 'pending';
};

export const createNotificationProposal = [
  Middlewares.Chainable
    .validate(({ req }) => ({
      body: joi.getValidatedOrThrow(notificationBodySchema, req.body),
    }))
    .next(async (express, { body }) => {
      const proposalId = randomUUID();
      const status = resolveNotificationStatus(body);

      await modelPlatformProposal.create({
        ...(status === 'approved' ? { approvedAt: new Date() } : {}),
        done: false,
        kind: 'notification',
        payload: body,
        proposalId,
        status,
      });

      express.res.status(201);
      express.respondOne<TResponseProposalCreated>({ id: proposalId });
    })
    .toMiddleware(),
];

export const createSettingProposal = [
  Middlewares.Chainable
    .validate(({ req }) => ({
      body: joi.getValidatedOrThrow(settingBodySchema, req.body),
    }))
    .next(async (express, { body }) => {
      const proposalId = randomUUID();

      await modelPlatformProposal.create({
        done: false,
        kind: 'setting',
        payload: body,
        proposalId,
        reason: body.reason,
        status: 'pending',
      });

      express.res.status(201);
      express.respondOne<TResponseProposalCreated>({ id: proposalId });
    })
    .toMiddleware(),
];

export const listPendingProposals = [
  Middlewares.Chainable
    .next(async (express) => {
      const items = await Queries.queryBy(modelPlatformProposal, {
        done: false,
        status: 'pending',
      });

      express.respondMany(items.map((item) => ({
        createdAt: item.createdAt,
        done: item.done,
        kind: item.kind,
        payload: item.payload,
        proposalId: item.proposalId,
        reason: item.reason,
        status: item.status,
      })));
    })
    .toMiddleware(),
];

export const approveProposal = [
  Middlewares.Chainable
    .validate(({ req }) => ({
      params: joi.getValidatedOrThrow(Joi.object({
        proposalId: Joi.string().required(),
      }), req.params),
    }))
    .next(async (express, { params }) => {
      const expected = process.env.PLATFORM_APPROVAL_TOKEN?.trim() ?? '';
      const provided = express.req.headers['x-approval-token'];
      const token = typeof provided === 'string' ? provided.trim() : '';

      if (!expected || token !== expected) {
        throw errors.custom('invalid approval token', 401);
      }

      const doc = await Queries.hasExactOne(modelPlatformProposal, {
        proposalId: params.proposalId,
      });

      if (doc.status !== 'pending') {
        throw errors.badRequest('proposal is not pending');
      }

      await modelPlatformProposal.updateOne(
        { proposalId: params.proposalId },
        {
          $set: {
            approvedAt: new Date(),
            status: 'approved',
          },
        },
      );

      express.respondOne({ id: params.proposalId, ok: true });
    })
    .toMiddleware(),
];

export const rejectProposal = [
  Middlewares.Chainable
    .validate(({ req }) => ({
      params: joi.getValidatedOrThrow(Joi.object({
        proposalId: Joi.string().required(),
      }), req.params),
    }))
    .next(async (express, { params }) => {
      await modelPlatformProposal.updateOne(
        { proposalId: params.proposalId, status: 'pending' },
        { $set: { status: 'rejected' } },
      );

      express.respondOne({ id: params.proposalId, ok: true });
    })
    .toMiddleware(),
];
