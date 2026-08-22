import Joi from 'joi';

import { Middlewares } from '@omni-infra/express';

import type { TWhatsAppChannelStatus } from '../-types';
import type { TRequestPutWhatsAppChannelBody } from '../-api-types';
import { assertWorkerInternalToken } from '../-worker-token';
import { modelPlatformChannelState } from '../models';

const WHATSAPP_CHANNEL = 'whatsapp';

const whatsAppBodySchema = Joi.object<TRequestPutWhatsAppChannelBody>({
  qrDataUrl: Joi.string().trim().allow('').optional(),
  status: Joi.string().valid('pending', 'ready', 'disconnected').required(),
});

export const putWhatsAppChannel = [
  Middlewares.Chainable
    .next(async (express) => {
      assertWorkerInternalToken(express.req.headers['x-worker-token']);
    })
    .validate(({ req }) => ({
      body: joi.getValidatedOrThrow(whatsAppBodySchema, req.body),
    }))
    .next(async (express, { body }) => {
      const status = body.status as TWhatsAppChannelStatus;
      const qrDataUrl = body.qrDataUrl?.trim() || undefined;
      const set: Record<string, unknown> = { status };

      if (status === 'pending' && qrDataUrl) {
        set.qrDataUrl = qrDataUrl;
      }

      if (status === 'ready' || status === 'disconnected') {
        set.qrDataUrl = null;
      }

      await modelPlatformChannelState.updateOne(
        { channel: WHATSAPP_CHANNEL },
        { $set: set },
        { upsert: true },
      );

      express.respondOne({ channel: WHATSAPP_CHANNEL, ok: true, status });
    })
    .toMiddleware(),
];
