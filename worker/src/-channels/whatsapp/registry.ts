import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  sanitizeWhatsAppFolder,
  whatsAppChatIdsMatch,
} from '@project-yahl/shared/whatsapp/whitelist';

import { whatsappConfig } from './config.js';

export type TPlatformIdentity = {
  chatId: string;
  displayName: string;
  lid?: string;
};

export type TOnboardedChannel = {
  chatId: string;
  displayName?: string;
  folder: string;
  greetsEntity?: string;
  lid?: string;
  onboardedAt: string;
  summary?: string;
  wikiRoot?: string;
};

type TChannelsFile = {
  channels: TOnboardedChannel[];
  platform?: TPlatformIdentity;
};

const channelsPath = () => path.join(whatsappConfig.inboxRoot, 'channels.json');

const readChannelsFile = async (): Promise<TChannelsFile> => {
  try {
    const raw = await readFile(channelsPath(), 'utf8');
    const parsed = JSON.parse(raw) as TChannelsFile;
    const channels = Array.isArray(parsed.channels) ? parsed.channels : [];
    const platform = parsed.platform
      && typeof parsed.platform === 'object'
      && typeof parsed.platform.chatId === 'string'
      ? {
          chatId: parsed.platform.chatId,
          displayName: typeof parsed.platform.displayName === 'string' && parsed.platform.displayName.trim()
            ? parsed.platform.displayName.trim()
            : 'YAHL',
          lid: typeof parsed.platform.lid === 'string' ? parsed.platform.lid : undefined,
        }
      : undefined;

    return { channels, platform };
  } catch {
    return { channels: [] };
  }
};

const writeChannelsFile = async (file: TChannelsFile): Promise<void> => {
  const payload: TChannelsFile = {
    channels: file.channels,
  };

  if (file.platform) {
    payload.platform = file.platform;
  }

  await writeFile(
    channelsPath(),
    `${JSON.stringify(payload, null, 2)}\n`,
  );
};

export const loadOnboardedChannels = async (): Promise<TOnboardedChannel[]> => {
  const file = await readChannelsFile();

  return file.channels;
};

export const loadPlatformIdentity = async (): Promise<TPlatformIdentity | undefined> => {
  const file = await readChannelsFile();

  return file.platform;
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

  const file = await readChannelsFile();
  const index = file.channels.findIndex((channel) =>
    whatsAppChatIdsMatch(chatId, channel.chatId));

  if (index < 0) {
    return;
  }

  const current = file.channels[index];

  if (current.lid?.trim().toLowerCase() === trimmedLid.toLowerCase()) {
    return;
  }

  file.channels[index] = { ...current, lid: trimmedLid };
  await writeChannelsFile(file);
  console.log(`[worker][whatsapp] remembered lid=${trimmedLid} for ${current.chatId}`);
};

export const rememberPlatformIdentity = async (from: string): Promise<void> => {
  const trimmed = from.trim();

  if (!trimmed.endsWith('@lid')) {
    return;
  }

  const file = await readChannelsFile();

  if (!file.platform?.chatId) {
    return;
  }

  if (file.platform.lid?.trim().toLowerCase() === trimmed.toLowerCase()) {
    return;
  }

  file.platform = { ...file.platform, lid: trimmed };
  await writeChannelsFile(file);
  console.log(`[worker][whatsapp] remembered platform lid=${trimmed}`);
};
