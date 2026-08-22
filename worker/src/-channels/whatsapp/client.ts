import type { Message } from 'whatsapp-web.js';

import path from 'node:path';

import qrcodeTerminal from 'qrcode-terminal';
import QRCode from 'qrcode';
import wweb from 'whatsapp-web.js';

import { putWhatsAppChannelState } from '../../-queue/platform-channel-api.js';

import { applyChannelMessageSanitizer } from '../sanitize-channel-message.js';
import { clearChromiumProfileLocks } from './clear-profile-locks.js';
import { whatsappConfig } from './config.js';
import { appendInboxMessage } from './inbox.js';
import { logSkippedMediaFromMessage } from './media.js';
import { rememberChannelLid, rememberPlatformIdentity } from './registry.js';
import { resolveCanonicalChatId } from './resolve-chat-id.js';
import {
  matchOutboundFlight,
  messageSnapshot,
} from './send-observe.js';

const { Client, LocalAuth } = wweb;

let client: InstanceType<typeof Client> | null = null;
let ready = false;
let starting = false;
let reinitInFlight = false;
let reinitTimer: ReturnType<typeof setTimeout> | null = null;
let onReadyListener: (() => void) | null = null;

export const setWhatsAppReadyListener = (listener: (() => void) | null): void => {
  onReadyListener = listener;
};

const REINIT_DELAY_MS = 3000;
const LOGOUT_REINIT_DELAY_MS = 10_000;
const seenMessageIds = new Set<string>();
const SEEN_MESSAGE_ID_CAP = 500;

const BROWSER_DEATH_RE = /target closed|protocol error|session closed|browser has been closed/i;
const RECOVERABLE_INIT_RE = /already exists|exposeFunction/i;

export const isWhatsAppBrowserDeathError = (error: unknown): boolean => {
  const name = error instanceof Error ? error.name : '';
  const message = error instanceof Error ? error.message : String(error);

  return name === 'TargetCloseError' || BROWSER_DEATH_RE.test(message);
};

export const isWhatsAppRecoverableInitError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);

  return RECOVERABLE_INIT_RE.test(message);
};

const reinitDelayForReason = (reason: string): number => {
  if (/LOGOUT|auth_failure/i.test(reason)) {
    return LOGOUT_REINIT_DELAY_MS;
  }

  return REINIT_DELAY_MS;
};

const messageDedupeKey = (msg: Message): string => {
  const serialized = msg.id?._serialized?.trim() ?? '';

  if (serialized) {
    return serialized;
  }

  const body = typeof msg.body === 'string' ? msg.body : '';

  return `anon:${msg.from}|${msg.to}|${msg.timestamp}|${body}`;
};

const rememberMessageId = (messageId: string): boolean => {
  if (seenMessageIds.has(messageId)) {
    return true;
  }

  seenMessageIds.add(messageId);

  if (seenMessageIds.size > SEEN_MESSAGE_ID_CAP) {
    const first = seenMessageIds.values().next().value;

    if (typeof first === 'string') {
      seenMessageIds.delete(first);
    }
  }

  return false;
};

const logMessageEvent = (event: string, msg: Message): void => {
  const body = typeof msg.body === 'string' ? msg.body : '';
  const snap = messageSnapshot(msg);

  console.log(
    `[worker][whatsapp] event=${event}`
    + ` fromMe=${msg.fromMe}`
    + ` type=${snap.type || msg.type}`
    + ` from=${snap.from || msg.from}`
    + ` to=${snap.to || msg.to}`
    + ` hasMedia=${msg.hasMedia}`
    + ` bodyLen=${body.length}`
    + ` id=${snap.id}`
    + ` ack=${snap.ack || '(none)'}`,
  );
};

export const isWhatsAppReady = (): boolean => ready && client !== null;

export const getWhatsAppClient = (): InstanceType<typeof Client> | null => client;

export const scheduleWhatsAppReinit = (reason: string): void => {
  if (!whatsappConfig.enabled) {
    return;
  }

  ready = false;

  if (reinitTimer) {
    return;
  }

  const delayMs = reinitDelayForReason(reason);

  console.warn(`[worker][whatsapp] schedule reinit in ${delayMs}ms (${reason})`);

  reinitTimer = setTimeout(() => {
    reinitTimer = null;

    if (starting || reinitInFlight) {
      console.warn(`[worker][whatsapp] reinit deferred, still busy (${reason})`);
      reinitTimer = setTimeout(() => {
        reinitTimer = null;
        scheduleWhatsAppReinit(reason);
      }, REINIT_DELAY_MS);
      return;
    }

    void reinitWhatsApp(reason).catch((error) => {
      console.error('[worker][whatsapp] reinit failed', reason, error);
    });
  }, delayMs);
};

const destroyWhatsAppClient = async (): Promise<void> => {
  ready = false;
  const prev = client;
  client = null;

  if (!prev) {
    return;
  }

  try {
    prev.removeAllListeners();
    await prev.destroy();
  } catch (error) {
    console.warn('[worker][whatsapp] destroy failed', error);
  }
};

export const reinitWhatsApp = async (reason: string): Promise<void> => {
  if (!whatsappConfig.enabled || starting || reinitInFlight) {
    return;
  }

  reinitInFlight = true;

  try {
    console.log(`[worker][whatsapp] reinit (${reason})`);
    await destroyWhatsAppClient();
    await initWhatsApp();
  } finally {
    reinitInFlight = false;
  }
};

const handleIncomingMessage = async (msg: Message, event: string): Promise<void> => {
  try {
    logMessageEvent(event, msg);

    const dedupeKey = messageDedupeKey(msg);
    const messageId = msg.id?._serialized ?? '';

    if (rememberMessageId(dedupeKey)) {
      console.log(`[worker][whatsapp] skip duplicate id=${dedupeKey}`);
      return;
    }

    if (msg.hasMedia) {
      logSkippedMediaFromMessage(msg);
      return;
    }

    const rawChatId = msg.fromMe ? msg.to : msg.from;
    const isGroup = rawChatId.endsWith('@g.us');
    const body = typeof msg.body === 'string' ? msg.body : '';

    if (!body.trim()) {
      console.log(`[worker][whatsapp] skip empty body raw=${rawChatId}`);
      return;
    }

    if (!client) {
      console.warn('[worker][whatsapp] skip no client');
      return;
    }

    const resolved = await resolveCanonicalChatId(client, rawChatId);

    if (!resolved) {
      console.log(`[worker][whatsapp] skip unresolved lid raw=${rawChatId}`);
      return;
    }

    if (resolved.lid && resolved.canonical !== rawChatId) {
      console.log(
        `[worker][whatsapp] resolved raw=${resolved.raw} pn=${resolved.canonical}`,
      );
    }

    if (msg.fromMe === true) {
      const snap = messageSnapshot(msg);
      const matched = matchOutboundFlight({
        bodyLen: body.length,
        chatId: resolved.canonical,
        lid: resolved.lid ?? (rawChatId.endsWith('@lid') ? rawChatId : undefined),
      });

      if (matched) {
        const ageMs = Date.now() - matched.startedAt;

        console.log(
          `[worker][whatsapp] fromMe echo matched outbound`
          + ` chat=${resolved.canonical}`
          + ` lid=${resolved.lid ?? rawChatId}`
          + ` bodyLen=${body.length}`
          + ` ageMs=${ageMs}`
          + ` outboundTo=${matched.chatId}`
          + ` channelLid=${matched.channelLid ?? '(none)'}`
          + ` echoId=${snap.id || '(none)'}`
          + ` echoAck=${snap.ack || '(none)'}`,
        );
      } else {
        console.log(
          `[worker][whatsapp] fromMe echo unmatched`
          + ` chat=${resolved.canonical}`
          + ` lid=${resolved.lid ?? rawChatId}`
          + ` bodyLen=${body.length}`
          + ` echoId=${snap.id || '(none)'}`
          + ` echoAck=${snap.ack || '(none)'}`,
        );
      }
    }

    const draft = await applyChannelMessageSanitizer({
      author: msg.author ?? undefined,
      body,
      chatId: resolved.canonical,
      from: msg.from,
      fromMe: msg.fromMe === true,
      isGroup,
      lid: resolved.lid,
      messageId,
      ts: new Date(msg.timestamp * 1000).toISOString(),
    });

    const sanitizedBody = typeof draft.body === 'string' ? draft.body : body;

    if (!sanitizedBody.trim()) {
      console.log(`[worker][whatsapp] skip empty body after sanitize raw=${rawChatId}`);
      return;
    }

    const persisted = await appendInboxMessage({
      author: typeof draft.author === 'string' ? draft.author : msg.author ?? undefined,
      body: sanitizedBody,
      chatId: resolved.canonical,
      from: typeof draft.from === 'string' ? draft.from : msg.from,
      fromMe: draft.fromMe === true,
      isGroup: draft.isGroup === true,
      lid: typeof draft.lid === 'string' ? draft.lid : resolved.lid,
      messageId: typeof draft.messageId === 'string' ? draft.messageId : messageId,
      ts: typeof draft.ts === 'string' ? draft.ts : new Date(msg.timestamp * 1000).toISOString(),
    });

    if (!persisted) {
      console.log('[worker][whatsapp] skip not onboarded', resolved.canonical);

      if (msg.fromMe) {
        console.log(`[worker][whatsapp] sendSeen skipped fromMe chat=${resolved.canonical} reason=not_onboarded`);
      }

      return;
    }

    console.log(`[worker][whatsapp] inbox append chat=${resolved.canonical}`);

    if (resolved.lid) {
      await rememberChannelLid(resolved.canonical, resolved.lid);
    }

    if (msg.fromMe) {
      await rememberPlatformIdentity(msg.from);
      console.log(`[worker][whatsapp] sendSeen skipped fromMe chat=${resolved.canonical}`);
    } else {
      try {
        await client.sendSeen(rawChatId);
        console.log(`[worker][whatsapp] sendSeen called chat=${resolved.canonical}`);
      } catch (error) {
        console.warn('[worker][whatsapp] sendSeen failed', rawChatId, error);
      }
    }
  } catch (error) {
    console.error('[worker][whatsapp] message handler failed', error);
  }
};

export const initWhatsApp = async (): Promise<void> => {
  if (!whatsappConfig.enabled) {
    console.log('[worker][whatsapp] disabled (WHATSAPP_ENABLED!=true)');
    return;
  }

  if (client || starting) {
    return;
  }

  starting = true;

  try {
    const chromePath = process.env.CHROME_PATH?.trim() || undefined;

    if (chromePath) {
      console.log(`[worker][whatsapp] CHROME_PATH=${chromePath}`);
    } else {
      console.warn('[worker][whatsapp] CHROME_PATH unset — Puppeteer may fail to find Chrome');
    }

    const sessionDir = path.join(whatsappConfig.authPath, 'session');

    await clearChromiumProfileLocks(sessionDir);

    const next = new Client({
      authStrategy: new LocalAuth({
        dataPath: whatsappConfig.authPath,
      }),
      puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        executablePath: chromePath,
        headless: true,
      },
    });

    next.on('qr', (qr) => {
      console.log('[worker][whatsapp] scan QR to log in:');
      qrcodeTerminal.generate(qr, { small: true });

      void (async () => {
        try {
          const qrDataUrl = await QRCode.toDataURL(qr);

          await putWhatsAppChannelState({ qrDataUrl, status: 'pending' });
        } catch (error) {
          console.warn('[worker][whatsapp] failed to publish QR to server', error);
        }
      })();
    });

    next.on('ready', () => {
      ready = true;
      console.log('[worker][whatsapp] client ready');
      void putWhatsAppChannelState({ status: 'ready' });
      onReadyListener?.();
    });

    next.on('authenticated', () => {
      console.log('[worker][whatsapp] authenticated');
    });

    next.on('auth_failure', (message) => {
      ready = false;
      console.error('[worker][whatsapp] auth_failure', message);
      void putWhatsAppChannelState({ status: 'disconnected' });
      scheduleWhatsAppReinit('auth_failure');
    });

    next.on('disconnected', (reason) => {
      ready = false;
      console.warn('[worker][whatsapp] disconnected', reason);
      void putWhatsAppChannelState({ status: 'disconnected' });
      scheduleWhatsAppReinit(`disconnected:${reason}`);
    });

    next.on('change_state', (state) => {
      console.log(`[worker][whatsapp] change_state=${state}`);
    });

    next.on('message_ciphertext', (msg) => {
      logMessageEvent('message_ciphertext', msg);
    });

    next.on('message_ciphertext_failed', (...args: unknown[]) => {
      console.error('[worker][whatsapp] message_ciphertext_failed', ...args);
    });

    next.on('message', (msg) => {
      if (msg.fromMe) {
        return;
      }

      void handleIncomingMessage(msg, 'message');
    });

    next.on('message_create', (msg) => {
      void handleIncomingMessage(msg, 'message_create');
    });

    client = next;

    await next.initialize();
  } catch (error) {
    if (isWhatsAppRecoverableInitError(error)) {
      console.warn('[worker][whatsapp] recoverable initialize error', error);
    } else {
      console.error('[worker][whatsapp] initialize failed', error);
    }

    await destroyWhatsAppClient();
    scheduleWhatsAppReinit(
      isWhatsAppRecoverableInitError(error) ? 'expose_function_conflict' : 'initialize_failed',
    );
  } finally {
    starting = false;
  }
};
