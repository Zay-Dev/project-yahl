import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { sanitizeWhatsAppFolder } from '@project-yahl/shared/whatsapp/whitelist';

import { whatsappConfig } from './config.js';

export type TOnboardedChannel = {
  chatId: string;
  displayName?: string;
  folder: string;
  onboardedAt: string;
};

type TChannelsFile = {
  channels: TOnboardedChannel[];
};

const channelsPath = () => path.join(whatsappConfig.inboxRoot, 'channels.json');

export const loadOnboardedChannels = async (): Promise<TOnboardedChannel[]> => {
  try {
    const raw = await readFile(channelsPath(), 'utf8');
    const parsed = JSON.parse(raw) as TChannelsFile;

    return Array.isArray(parsed.channels) ? parsed.channels : [];
  } catch {
    return [];
  }
};

export const findOnboardedChannel = async (
  chatId: string,
): Promise<TOnboardedChannel | undefined> => {
  const channels = await loadOnboardedChannels();
  const normalized = chatId.trim().toLowerCase();
  const folder = sanitizeWhatsAppFolder(chatId);

  return channels.find((channel) =>
    channel.chatId.trim().toLowerCase() === normalized
    || channel.folder === folder);
};
