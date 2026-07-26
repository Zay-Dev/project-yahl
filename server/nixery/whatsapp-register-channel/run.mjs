import fs from 'node:fs/promises';
import path from 'node:path';

import { logProgress, resolveDefId } from '../_shared/run-agent.mjs';

const INBOX_ROOT = '/whatsapp/inbox';
const CHANNELS_FILE = path.join(INBOX_ROOT, 'channels.json');

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

const loadChannels = async () => {
  try {
    const parsed = await readJson(CHANNELS_FILE);

    return Array.isArray(parsed.channels) ? parsed.channels : [];
  } catch {
    return [];
  }
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
  const chatId = toChatId(channelRef);
  const folder = sanitizeFolder(chatId);

  logProgress(defId, `register chatId=${chatId} folder=${folder}`);

  await fs.mkdir(INBOX_ROOT, { recursive: true });
  await fs.mkdir(path.join(INBOX_ROOT, folder), { recursive: true });

  const channels = await loadChannels();
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

  await fs.writeFile(
    CHANNELS_FILE,
    `${JSON.stringify({ channels }, null, 2)}\n`,
    'utf8',
  );

  const result = { ok: true, channel: existingIndex >= 0 ? channels[existingIndex] : record };

  await fs.writeFile(path.join(workspace, outputName), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  logProgress(defId, `done folder=${folder}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
