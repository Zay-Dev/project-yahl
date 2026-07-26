import type { Message } from 'whatsapp-web.js';

import path from 'node:path';

import qrcode from 'qrcode-terminal';
import wweb from 'whatsapp-web.js';

import { clearChromiumProfileLocks } from './clear-profile-locks.js';
import { whatsappConfig } from './config.js';
import { appendInboxMessage } from './inbox.js';
import { logSkippedMediaFromMessage } from './media.js';
import { rememberChannelLid } from './registry.js';
import { resolveCanonicalChatId } from './resolve-chat-id.js';

const { Client, LocalAuth } = wweb;

let client: InstanceType<typeof Client> | null = null;
let ready = false;

const seenMessageIds = new Set<string>();
const SEEN_MESSAGE_ID_CAP = 500;

const rememberMessageId = (messageId: string): boolean => {
  if (!messageId) {
    return false;
  }

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
  const id = msg.id?._serialized ?? '';

  console.log(
    `[worker][whatsapp] event=${event}`
    + ` fromMe=${msg.fromMe}`
    + ` type=${msg.type}`
    + ` from=${msg.from}`
    + ` to=${msg.to}`
    + ` hasMedia=${msg.hasMedia}`
    + ` bodyLen=${body.length}`
    + ` id=${id}`,
  );
};

export const isWhatsAppReady = (): boolean => ready && client !== null;

export const getWhatsAppClient = (): InstanceType<typeof Client> | null => client;

const handleIncomingMessage = async (msg: Message, event: string): Promise<void> => {
  try {
    logMessageEvent(event, msg);

    const messageId = msg.id?._serialized ?? '';

    if (rememberMessageId(messageId)) {
      console.log(`[worker][whatsapp] skip duplicate id=${messageId}`);
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

    const persisted = await appendInboxMessage({
      author: msg.author ?? undefined,
      body,
      chatId: resolved.canonical,
      from: msg.from,
      isGroup,
      lid: resolved.lid,
      messageId,
      ts: new Date(msg.timestamp * 1000).toISOString(),
    });

    if (!persisted) {
      console.log('[worker][whatsapp] skip not onboarded', resolved.canonical);
      return;
    }

    console.log(`[worker][whatsapp] inbox append chat=${resolved.canonical}`);

    if (resolved.lid) {
      await rememberChannelLid(resolved.canonical, resolved.lid);
    }

    try {
      await client.sendSeen(rawChatId);
    } catch (error) {
      console.warn('[worker][whatsapp] sendSeen failed', rawChatId, error);
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

  if (client) {
    return;
  }

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
    qrcode.generate(qr, { small: true });
  });

  next.on('ready', () => {
    ready = true;
    console.log('[worker][whatsapp] client ready');
  });

  next.on('authenticated', () => {
    console.log('[worker][whatsapp] authenticated');
  });

  next.on('auth_failure', (message) => {
    ready = false;
    console.error('[worker][whatsapp] auth_failure', message);
  });

  next.on('disconnected', (reason) => {
    ready = false;
    console.warn('[worker][whatsapp] disconnected', reason);
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
};
