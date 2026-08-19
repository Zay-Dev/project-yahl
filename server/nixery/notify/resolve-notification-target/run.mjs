import fs from 'node:fs/promises';
import path from 'node:path';

import { loadTopicCorpus } from '/opt/nixery/plugin/lib/dist/index.js';
import { logProgress, resolveDefId } from '../lib/run-agent.mjs';

const CHANNELS_FILE = '/whatsapp/inbox/channels.json';

const readJson = async (filePath) => {
  const raw = await fs.readFile(filePath, 'utf8');

  return JSON.parse(raw);
};

const stripToDigits = (value) => String(value).replace(/\D/g, '');

const isEmailTarget = (value) => {
  const trimmed = String(value).trim();

  if (!trimmed.includes('@')) {
    return false;
  }

  const lower = trimmed.toLowerCase();

  if (lower.endsWith('@c.us') || lower.endsWith('@g.us') || lower.endsWith('@lid')) {
    return false;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
};

const toWhatsAppChatId = (recipient) => {
  const trimmed = String(recipient).trim();

  if (!trimmed) {
    return '';
  }

  if (trimmed.includes('@')) {
    return trimmed.toLowerCase();
  }

  const digits = stripToDigits(trimmed);

  return digits ? `${digits}@c.us` : '';
};

const sanitizeFolder = (chatId) => {
  const raw = String(chatId).trim().toLowerCase() || 'unknown';

  return raw.replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'unknown';
};

const chatIdsMatch = (left, right) => {
  const a = String(left).trim().toLowerCase();
  const b = String(right).trim().toLowerCase();

  if (!a || !b) {
    return false;
  }

  if (a === b) {
    return true;
  }

  const aDigits = stripToDigits(a.split('@')[0] ?? '');
  const bDigits = stripToDigits(b.split('@')[0] ?? '');

  if (!aDigits || !bDigits) {
    return false;
  }

  return aDigits === bDigits
    || aDigits.endsWith(bDigits)
    || bDigits.endsWith(aDigits);
};

const isUserSummary = (summary) => {
  const text = String(summary ?? '').trim().toLowerCase();

  if (!text) {
    return false;
  }

  if (
    /user'?s?\s+phone/.test(text)
    || /my\s+primary\s+phone/.test(text)
    || /my\s+phone\s+number/.test(text)
    || /^(the\s+)?user(\s|$|,|\.)/.test(text)
    || /\bmyself\b/.test(text)
  ) {
    return true;
  }

  return false;
};

const loadChannels = async () => {
  try {
    const parsed = await readJson(CHANNELS_FILE);
    const channels = Array.isArray(parsed.channels) ? parsed.channels : [];

    return channels;
  } catch {
    return [];
  }
};

const findChannel = (channels, chatId) => {
  const folder = sanitizeFolder(chatId);

  return channels.find((channel) =>
    channel.folder === folder
    || chatIdsMatch(chatId, channel.chatId));
};

const loadUserPreference = async () => {
  try {
    const loaded = await loadTopicCorpus('user-onboarding', { maxBytes: 120_000 });
    const corpus = typeof loaded?.corpus === 'string' ? loaded.corpus.trim() : '';

    return corpus;
  } catch {
    return '';
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
  const outputPath = path.join(workspace, outputName);
  const rawTo = String(input.to ?? '').trim();
  const nameOverride = typeof input.name === 'string' ? input.name.trim() : '';

  logProgress(defId, `start to=${rawTo}`);

  if (!rawTo) {
    const gate = { ok: false, error: 'to is required' };

    await fs.writeFile(outputPath, `${JSON.stringify(gate, null, 2)}\n`, 'utf8');
    process.exit(1);
  }

  if (isEmailTarget(rawTo)) {
    const gate = {
      ok: true,
      channel: 'email',
      to: rawTo.toLowerCase(),
      name: nameOverride,
      summary: '',
      preference: '',
      isUser: false,
      greetsEntity: '',
    };

    await fs.writeFile(outputPath, `${JSON.stringify(gate, null, 2)}\n`, 'utf8');
    logProgress(defId, 'done channel=email');

    return;
  }

  const chatId = toWhatsAppChatId(rawTo);
  const channels = await loadChannels();
  const matched = chatId ? findChannel(channels, chatId) : undefined;
  const summary = typeof matched?.summary === 'string' ? matched.summary.trim() : '';
  const isUser = isUserSummary(summary);
  const name = nameOverride
    || (typeof matched?.displayName === 'string' ? matched.displayName.trim() : '')
    || '';
  const greetsEntity = typeof matched?.greetsEntity === 'string'
    ? matched.greetsEntity.trim()
    : '';

  let preference = '';

  if (isUser) {
    preference = await loadUserPreference();
  } else {
    preference = summary;
  }

  const gate = {
    ok: true,
    channel: 'whatsapp',
    to: chatId || rawTo,
    name,
    summary,
    preference,
    isUser,
    greetsEntity,
  };

  await fs.writeFile(outputPath, `${JSON.stringify(gate, null, 2)}\n`, 'utf8');
  logProgress(defId, `done channel=whatsapp isUser=${isUser} matched=${Boolean(matched)}`);
};

main().catch(async (error) => {
  console.error(error);

  try {
    await fs.writeFile(
      '/workspace/result.json',
      `${JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : 'resolve-notification-target failed',
      }, null, 2)}\n`,
      'utf8',
    );
  } catch {
    // ignore
  }

  process.exit(1);
});
