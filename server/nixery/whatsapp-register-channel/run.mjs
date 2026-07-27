import fs from 'node:fs/promises';
import path from 'node:path';

import { logProgress, resolveDefId } from '../_shared/run-agent.mjs';

const INBOX_ROOT = '/whatsapp/inbox';
const CHANNELS_FILE = path.join(INBOX_ROOT, 'channels.json');
const DEFAULT_ASSISTANT_NAME = 'YAHL';

const readJson = async (filePath) => {
  const raw = await fs.readFile(filePath, 'utf8');

  return JSON.parse(raw);
};

const sanitizeFolder = (chatId) => {
  const raw = String(chatId).trim().toLowerCase() || 'unknown';

  return raw.replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'unknown';
};

const toChatId = (channelRef) => {
  const trimmed = String(channelRef).trim();

  if (!trimmed) {
    throw new Error('channelRef is required');
  }

  if (trimmed.includes('@')) {
    return trimmed;
  }

  const digits = trimmed.replace(/\D/g, '');

  if (!digits) {
    throw new Error('channelRef must be a phone number or WhatsApp chat id');
  }

  return `${digits}@c.us`;
};

const loadChannelsFile = async () => {
  try {
    const parsed = await readJson(CHANNELS_FILE);
    const channels = Array.isArray(parsed.channels) ? parsed.channels : [];
    const platform = parsed.platform && typeof parsed.platform === 'object' && !Array.isArray(parsed.platform)
      ? parsed.platform
      : undefined;

    return { channels, platform };
  } catch {
    return { channels: [], platform: undefined };
  }
};

const mergePlatform = (existing, agentPhone, assistantName) => {
  const phone = typeof agentPhone === 'string' ? agentPhone.trim() : '';
  const name = typeof assistantName === 'string' ? assistantName.trim() : '';

  if (!phone && !existing) {
    return undefined;
  }

  if (!phone) {
    return {
      ...existing,
      displayName: name || existing.displayName || DEFAULT_ASSISTANT_NAME,
    };
  }

  const chatId = toChatId(phone);

  return {
    chatId,
    displayName: name || existing?.displayName || DEFAULT_ASSISTANT_NAME,
    lid: existing?.lid,
  };
};

const main = async () => {
  const workspace = '/workspace';
  const defRoot = '/opt/nixery/def';
  const defId = resolveDefId(defRoot);
  const input = await readJson(path.join(workspace, 'input.json'));
  const outputName = typeof input.output === 'string' && input.output.trim()
    ? input.output.trim()
    : 'result.json';
  const channelRef = String(input.channelRef ?? '').trim();
  const displayName = typeof input.displayName === 'string' ? input.displayName.trim() : '';
  const agentPhone = typeof input.agentPhone === 'string' ? input.agentPhone.trim() : '';
  const assistantName = typeof input.assistantName === 'string' ? input.assistantName.trim() : '';
  const chatId = toChatId(channelRef);
  const folder = sanitizeFolder(chatId);

  logProgress(defId, `register chatId=${chatId} folder=${folder}`);

  await fs.mkdir(INBOX_ROOT, { recursive: true });
  await fs.mkdir(path.join(INBOX_ROOT, folder), { recursive: true });

  const { channels, platform: existingPlatform } = await loadChannelsFile();
  const platform = mergePlatform(existingPlatform, agentPhone, assistantName);

  if (!platform) {
    throw new Error('agentPhone is required when platform identity is not already stored');
  }

  const existingIndex = channels.findIndex((item) =>
    String(item.chatId).toLowerCase() === chatId.toLowerCase()
    || item.folder === folder);
  const record = {
    chatId,
    displayName: displayName || undefined,
    folder,
    onboardedAt: new Date().toISOString(),
    wikiRoot: `whatsapp/${folder}`,
  };

  if (existingIndex >= 0) {
    channels[existingIndex] = {
      ...channels[existingIndex],
      ...record,
      onboardedAt: channels[existingIndex].onboardedAt ?? record.onboardedAt,
    };
  } else {
    channels.push(record);
  }

  const payload = { platform, channels };

  await fs.writeFile(
    CHANNELS_FILE,
    `${JSON.stringify(payload, null, 2)}\n`,
    'utf8',
  );

  const result = {
    ok: true,
    channel: existingIndex >= 0 ? channels[existingIndex] : record,
    platform,
  };

  await fs.writeFile(path.join(workspace, outputName), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  logProgress(defId, `done folder=${folder} platform=${platform.chatId}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
