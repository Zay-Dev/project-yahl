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
import {
  beginOutboundFlight,
  endOutboundFlight,
  formatSendResultLog,
  messageSnapshot,
  resolveSendDiagnostics,
  waitAndReadAck,
  WHATSAPP_ACK_FOLLOWUP_MS,
} from './whatsapp/send-observe.js';

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

  const diagnostics = await resolveSendDiagnostics(client, chatId);
  const flight = beginOutboundFlight({
    bodyLen: params.body.length,
    channelLid: diagnostics.channelLid || undefined,
    chatId,
  });

  console.log(
    formatSendResultLog({
      phase: 'start',
      rawTo: params.to,
      to: chatId,
      channelLid: diagnostics.channelLid,
      apiLid: diagnostics.apiLid,
      apiPn: diagnostics.apiPn,
      bodyLen: params.body.length,
      fromIdentity: params.fromIdentity ?? 'default',
    }),
  );

  const startedAt = Date.now();

  try {
    const sent = await withTimeout(
      client.sendMessage(chatId, params.body),
      config.whatsappSendTimeoutMs,
      'whatsapp sendMessage',
    );
    const elapsedMs = Date.now() - startedAt;
    const snap = messageSnapshot(sent);

    console.log(
      formatSendResultLog({
        phase: 'returned',
        rawTo: params.to,
        to: chatId,
        channelLid: diagnostics.channelLid,
        apiLid: diagnostics.apiLid,
        apiPn: diagnostics.apiPn,
        msgId: snap.id,
        ack: snap.ack,
        from: snap.from,
        msgTo: snap.to,
        type: snap.type,
        timestamp: snap.timestamp,
        ms: elapsedMs,
        fromIdentity: params.fromIdentity ?? 'default',
      }),
    );

    if (!snap.id) {
      console.warn(
        `[worker][whatsapp] send returned without msgId to=${chatId} (observe-only; still marking ok)`,
      );
    }

    if (!sent) {
      console.log(
        formatSendResultLog({
          phase: 'ack_followup',
          to: chatId,
          msgId: '(none)',
          reason: 'no-message',
          ack_initial: '(no-message)',
          ack_after_wait: '(skipped)',
        }),
      );
    } else {
      const { ackAfter, ackInitial } = await waitAndReadAck(sent);

      console.log(
        formatSendResultLog({
          phase: 'ack_followup',
          to: chatId,
          msgId: snap.id,
          ack_initial: ackInitial,
          ack_after_wait: ackAfter,
          waitMs: WHATSAPP_ACK_FOLLOWUP_MS,
        }),
      );
    }

    console.log('[worker][whatsapp] sent', params.fromIdentity ?? 'default', '→', chatId);

    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const elapsedMs = Date.now() - startedAt;

    console.error(
      formatSendResultLog({
        phase: 'failed',
        to: chatId,
        channelLid: diagnostics.channelLid,
        apiLid: diagnostics.apiLid,
        apiPn: diagnostics.apiPn,
        ms: elapsedMs,
        err: message,
      }),
    );

    const shouldReinit = message.includes('timed out') || isWhatsAppBrowserDeathError(error);

    if (shouldReinit) {
      scheduleWhatsAppReinit(
        message.includes('timed out') ? 'send_timeout' : 'send_browser_death',
      );
    }

    return { ok: false, error: message };
  } finally {
    endOutboundFlight(flight);
  }
};
