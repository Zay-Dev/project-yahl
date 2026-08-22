import { Middlewares } from '@omni-infra/express';
import { Queries } from '@omni-infra/mongoose';

import type { TResponseWhatsAppChannel } from '../-api-types';
import { modelPlatformChannelState } from '../models';

const WHATSAPP_CHANNEL = 'whatsapp';

export const getWhatsAppChannel = [
  Middlewares.Chainable
    .next(async (express) => {
      const items = await Queries.queryBy(modelPlatformChannelState, { channel: WHATSAPP_CHANNEL });
      const doc = items[0];

      if (!doc) {
        express.respondOne<TResponseWhatsAppChannel>({
          status: 'disconnected',
          updatedAt: null,
        });
        return;
      }

      express.respondOne<TResponseWhatsAppChannel>({
        qrDataUrl: doc.qrDataUrl ?? undefined,
        status: doc.status as TResponseWhatsAppChannel['status'],
        updatedAt: doc.updatedAt?.toISOString() ?? null,
      });
    })
    .toMiddleware(),
];
