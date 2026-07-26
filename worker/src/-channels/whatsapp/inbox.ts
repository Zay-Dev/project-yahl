import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

import { whatsappConfig } from './config.js';
import { findOnboardedChannel } from './registry.js';

export type TInboxMessage = {
  author?: string;
  body: string;
  chatId: string;
  from: string;
  isGroup: boolean;
  messageId: string;
  ts: string;
};

export const appendInboxMessage = async (message: TInboxMessage): Promise<boolean> => {
  const channel = await findOnboardedChannel(message.chatId);

  if (!channel) {
    return false;
  }

  const dir = path.join(whatsappConfig.inboxRoot, channel.folder);

  await mkdir(dir, { recursive: true });

  const line = `${JSON.stringify(message)}\n`;

  await appendFile(path.join(dir, 'messages.jsonl'), line, 'utf8');

  return true;
};
