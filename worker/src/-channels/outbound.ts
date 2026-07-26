import { toWhatsAppChatId } from '@project-yahl/shared/whatsapp/whitelist';

import { getWhatsAppClient, isWhatsAppReady } from './whatsapp/client.js';
import { whatsappConfig } from './whatsapp/config.js';

export type TSendResult = {
  error?: string;
  ok: boolean;
  skipped?: boolean;
};

export const sendEmail = async (params: {
  body: string;
  fromIdentity?: string;
  to: string;
}): Promise<TSendResult> => {
  const host = process.env.SMTP_HOST?.trim();

  if (!host) {
    console.log('[worker][email:stub]', params.to, params.body.slice(0, 120));
    return { ok: true };
  }

  console.log('[worker][email]', params.fromIdentity ?? 'default', '→', params.to);
  return { ok: true };
};

export const sendWhatsApp = async (params: {
  body: string;
  fromIdentity?: string;
  to: string;
}): Promise<TSendResult> => {
  if (!whatsappConfig.enabled) {
    console.log('[worker][whatsapp:stub]', params.to, params.body.slice(0, 120));
    return { ok: true };
  }

  if (!isWhatsAppReady()) {
    console.log(
      '[worker][whatsapp] skip approved notification: not logged in',
      params.to,
    );
    return { ok: false, skipped: true, error: 'whatsapp not logged in' };
  }

  const chatId = toWhatsAppChatId(params.to);

  if (!chatId) {
    return { ok: false, error: 'invalid whatsapp recipient' };
  }

  const client = getWhatsAppClient();

  if (!client) {
    return { ok: false, skipped: true, error: 'whatsapp client missing' };
  }

  await client.sendMessage(chatId, params.body);
  console.log('[worker][whatsapp] sent', params.fromIdentity ?? 'default', '→', chatId);

  return { ok: true };
};
