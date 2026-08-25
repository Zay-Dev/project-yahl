import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

import { whatsappConfig } from './config.js';
import type { TInboxAttachment } from './media.js';
import { findOnboardedChannel } from './registry.js';

export type { TInboxAttachment } from './media.js';

export type TInboxMessage = {
  attachments?: TInboxAttachment[];
  author?: string;
  body: string;
  chatId: string;
  from: string;
  fromMe?: boolean;
  isGroup: boolean;
  lid?: string;
  messageId: string;
  ts: string;
};

export const appendInboxMessage = async (message: TInboxMessage): Promise<boolean> => {
  const channel = await findOnboardedChannel(message.chatId, message.lid);

  if (!channel) {
    return false;
  }

  const dir = path.join(whatsappConfig.inboxRoot, channel.folder);

  await mkdir(dir, { recursive: true });

  const line = `${JSON.stringify({
    ...message,
    chatId: channel.chatId,
  })}\n`;

  await appendFile(path.join(dir, 'messages.jsonl'), line, 'utf8');

  return true;
};
