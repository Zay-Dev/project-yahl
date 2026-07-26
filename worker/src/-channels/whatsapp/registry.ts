import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  sanitizeWhatsAppFolder,
  whatsAppChatIdsMatch,
} from '@project-yahl/shared/whatsapp/whitelist';

import { whatsappConfig } from './config.js';

export type TOnboardedChannel = {
  chatId: string;
  displayName?: string;
  folder: string;
  lid?: string;
  onboardedAt: string;
  wikiRoot?: string;
};

type TChannelsFile = {
  channels: TOnboardedChannel[];
};

const channelsPath = () => path.join(whatsappConfig.inboxRoot, 'channels.json');

const writeChannels = async (channels: TOnboardedChannel[]): Promise<void> => {
  await writeFile(
    channelsPath(),
    `${JSON.stringify({ channels }, null, 2)}\n`,
    'utf8',
  );
};

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
  lid?: string,
): Promise<TOnboardedChannel | undefined> => {
  const channels = await loadOnboardedChannels();
  const folder = sanitizeWhatsAppFolder(chatId);
  const lidKey = lid?.trim().toLowerCase();

  return channels.find((channel) => {
    if (channel.folder === folder || whatsAppChatIdsMatch(chatId, channel.chatId)) {
      return true;
    }

    if (lidKey && channel.lid?.trim().toLowerCase() === lidKey) {
      return true;
    }

    return false;
  });
};

export const rememberChannelLid = async (
  chatId: string,
  lid: string,
): Promise<void> => {
  const trimmedLid = lid.trim();

  if (!trimmedLid.endsWith('@lid')) {
    return;
  }

  const channels = await loadOnboardedChannels();
  const index = channels.findIndex((channel) =>
    whatsAppChatIdsMatch(chatId, channel.chatId));

  if (index < 0) {
    return;
  }

  const current = channels[index];

  if (current.lid?.trim().toLowerCase() === trimmedLid.toLowerCase()) {
    return;
  }

  channels[index] = { ...current, lid: trimmedLid };
  await writeChannels(channels);
  console.log(`[worker][whatsapp] remembered lid=${trimmedLid} for ${current.chatId}`);
};
