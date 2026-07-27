import { toWhatsAppChatId } from '@project-yahl/shared/whatsapp/whitelist';

import { config } from '../config.js';
import {
  getWhatsAppClient,
  isWhatsAppReady,
  scheduleWhatsAppReinit,
} from './whatsapp/client.js';
import { whatsappConfig } from './whatsapp/config.js';

export type TSendResult = {
  error?: string;
  ok: boolean;
  skipped?: boolean;
};

const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`${label} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
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

  try {
    await withTimeout(
      client.sendMessage(chatId, params.body),
      config.whatsappSendTimeoutMs,
      'whatsapp sendMessage',
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[worker][whatsapp] send failed', chatId, message);

    const shouldReinit = message.includes('timed out')
      || /target closed|protocol error|session closed|browser has been closed/i.test(message);

    if (shouldReinit) {
      scheduleWhatsAppReinit(
        message.includes('timed out') ? 'send_timeout' : 'send_browser_death',
      );
    }

    return { ok: false, error: message };
  }

  console.log('[worker][whatsapp] sent', params.fromIdentity ?? 'default', '→', chatId);

  return { ok: true };
};
