import qrcode from 'qrcode-terminal';
import wweb from 'whatsapp-web.js';
import type { Message } from 'whatsapp-web.js';

import { whatsappConfig } from './config.js';
import { appendInboxMessage } from './inbox.js';
import { logSkippedMediaFromMessage } from './media.js';

const { Client, LocalAuth } = wweb;

let client: InstanceType<typeof Client> | null = null;
let ready = false;

export const isWhatsAppReady = (): boolean => ready && client !== null;

export const getWhatsAppClient = (): InstanceType<typeof Client> | null => client;

const handleIncomingMessage = async (msg: Message): Promise<void> => {
  try {
    if (msg.hasMedia) {
      logSkippedMediaFromMessage(msg);
      return;
    }

    const chat = await msg.getChat();
    const chatId = chat.id._serialized;
    const body = typeof msg.body === 'string' ? msg.body : '';

    if (!body.trim()) {
      return;
    }

    const persisted = await appendInboxMessage({
      author: msg.author ?? undefined,
      body,
      chatId,
      from: msg.from,
      isGroup: chat.isGroup,
      messageId: msg.id._serialized,
      ts: new Date(msg.timestamp * 1000).toISOString(),
    });

    if (persisted) {
      console.log(`[worker][whatsapp] inbox append chat=${chatId}`);
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

  next.on('message', (msg) => {
    void handleIncomingMessage(msg);
  });

  client = next;

  await next.initialize();
};
