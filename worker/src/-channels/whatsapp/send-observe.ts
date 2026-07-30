import type { Client, Message } from 'whatsapp-web.js';

import { whatsAppChatIdsMatch } from '@project-yahl/shared/whatsapp/whitelist';

import { findOnboardedChannel } from './registry.js';

export const WHATSAPP_ACK_FOLLOWUP_MS = Number(
  process.env.WORKER_WHATSAPP_ACK_FOLLOWUP_MS?.trim() || '3000',
);

export type TOutboundFlight = {
  bodyLen: number;
  chatId: string;
  channelLid?: string;
  startedAt: number;
};

const inflight: TOutboundFlight[] = [];
const INFLIGHT_TTL_MS = 60_000;

const pruneInflight = (now = Date.now()): void => {
  while (inflight.length > 0) {
    const first = inflight[0];

    if (!first || now - first.startedAt <= INFLIGHT_TTL_MS) {
      break;
    }

    inflight.shift();
  }
};

export const beginOutboundFlight = (flight: Omit<TOutboundFlight, 'startedAt'>): TOutboundFlight => {
  pruneInflight();

  const entry: TOutboundFlight = {
    ...flight,
    startedAt: Date.now(),
  };

  inflight.push(entry);

  return entry;
};

export const endOutboundFlight = (flight: TOutboundFlight): void => {
  const index = inflight.indexOf(flight);

  if (index >= 0) {
    inflight.splice(index, 1);
  }
};

export const matchOutboundFlight = (params: {
  bodyLen: number;
  chatId: string;
  lid?: string;
}): TOutboundFlight | undefined => {
  pruneInflight();

  const now = Date.now();

  for (let i = inflight.length - 1; i >= 0; i -= 1) {
    const flight = inflight[i];

    if (!flight || now - flight.startedAt > INFLIGHT_TTL_MS) {
      continue;
    }

    if (flight.bodyLen !== params.bodyLen) {
      continue;
    }

    const sameChat = whatsAppChatIdsMatch(flight.chatId, params.chatId)
      || (params.lid ? whatsAppChatIdsMatch(flight.chatId, params.lid) : false)
      || (flight.channelLid && params.lid
        ? flight.channelLid.toLowerCase() === params.lid.toLowerCase()
        : false)
      || (flight.channelLid
        ? whatsAppChatIdsMatch(flight.channelLid, params.chatId)
        : false);

    if (sameChat) {
      return flight;
    }
  }

  return undefined;
};

export const messageSnapshot = (msg: Message | null | undefined): {
  ack: string;
  from: string;
  id: string;
  timestamp: string;
  to: string;
  type: string;
} => {
  if (!msg) {
    return {
      ack: '',
      from: '',
      id: '',
      timestamp: '',
      to: '',
      type: '',
    };
  }

  return {
    ack: msg.ack === undefined || msg.ack === null ? '' : String(msg.ack),
    from: typeof msg.from === 'string' ? msg.from : '',
    id: msg.id?._serialized?.trim() ?? '',
    timestamp: msg.timestamp ? String(msg.timestamp) : '',
    to: typeof msg.to === 'string' ? msg.to : '',
    type: typeof msg.type === 'string' ? msg.type : '',
  };
};

export const resolveSendDiagnostics = async (
  wa: Client,
  chatId: string,
): Promise<{ apiLid: string; apiPn: string; channelLid: string }> => {
  const channel = await findOnboardedChannel(chatId);
  const channelLid = channel?.lid?.trim() ?? '';

  let apiLid = '';
  let apiPn = '';

  try {
    const rows = await wa.getContactLidAndPhone([chatId]);
    const row = rows[0];

    apiLid = typeof row?.lid === 'string' ? row.lid.trim() : '';
    apiPn = typeof row?.pn === 'string' ? row.pn.trim() : '';
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    console.warn(`[worker][whatsapp] getContactLidAndPhone failed to=${chatId} err=${message}`);
  }

  return { apiLid, apiPn, channelLid };
};

export const waitAndReadAck = async (
  msg: Message | null | undefined,
  waitMs = WHATSAPP_ACK_FOLLOWUP_MS,
): Promise<{ ackAfter: string; ackInitial: string }> => {
  if (!msg) {
    return { ackAfter: '(skipped)', ackInitial: '(no-message)' };
  }

  const initial = messageSnapshot(msg);
  const ackInitial = initial.ack || '(missing)';

  await new Promise<void>((resolve) => {
    setTimeout(resolve, waitMs);
  });

  let ackAfter = messageSnapshot(msg).ack || '(missing)';

  try {
    if (typeof msg.reload === 'function') {
      const reloaded = await msg.reload();
      const snap = messageSnapshot(reloaded ?? msg);

      if (snap.ack) {
        ackAfter = snap.ack;
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    console.warn(`[worker][whatsapp] ack reload failed id=${initial.id || '(none)'} err=${message}`);
  }

  return { ackAfter, ackInitial };
};

export const formatSendResultLog = (parts: Record<string, string | number>): string => {
  const body = Object.entries(parts)
    .map(([key, value]) => `${key}=${value === '' ? '(none)' : value}`)
    .join(' ');

  return `[worker][whatsapp] send result ${body}`;
};
