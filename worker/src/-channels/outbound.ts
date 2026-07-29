import type { Transporter } from 'nodemailer';

import nodemailer from 'nodemailer';

import { toWhatsAppChatId } from '@project-yahl/shared/whatsapp/whitelist';

import { config } from '../config.js';
import {
  getWhatsAppClient,
  isWhatsAppBrowserDeathError,
  isWhatsAppReady,
  scheduleWhatsAppReinit,
} from './whatsapp/client.js';
import { whatsappConfig } from './whatsapp/config.js';

export type TSendResult = {
  error?: string;
  ok: boolean;
  skipped?: boolean;
};

let transporter: Transporter | null = null;

export const isSmtpConfigured = (): boolean =>
  Boolean(process.env.SMTP_HOST?.trim());

export const getSystemAdminEmail = (): string =>
  process.env.SYSTEM_ADMIN_EMAIL?.trim() ?? '';

const getSmtpFrom = (): string => {
  const from = process.env.SMTP_FROM?.trim();

  if (from) {
    return from;
  }

  const user = process.env.SMTP_USER?.trim();

  if (user) {
    return user;
  }

  return 'noreply@localhost';
};

const getTransporter = (): Transporter => {
  if (transporter) {
    return transporter;
  }

  const host = process.env.SMTP_HOST?.trim() ?? '';
  const port = Number(process.env.SMTP_PORT?.trim() || '587');
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const secure = process.env.SMTP_SECURE?.trim() === 'true';

  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    ...(user
      ? {
          auth: {
            pass: pass ?? '',
            user,
          },
        }
      : {}),
  });

  return transporter;
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
  subject?: string;
  to: string;
}): Promise<TSendResult> => {
  if (!isSmtpConfigured()) {
    console.log('[worker][email:stub]', params.to, params.body.slice(0, 120));
    return { ok: true };
  }

  const subject = params.subject?.trim()
    || (params.fromIdentity ? `Notification (${params.fromIdentity})` : 'Notification');

  try {
    await getTransporter().sendMail({
      from: getSmtpFrom(),
      subject,
      text: params.body,
      to: params.to,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[worker][email] send failed', params.to, message);
    return { ok: false, error: message };
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

    const shouldReinit = message.includes('timed out') || isWhatsAppBrowserDeathError(error);

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
