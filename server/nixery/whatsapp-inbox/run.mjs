import fs from 'node:fs/promises';
import path from 'node:path';

import { logProgress, resolveDefId } from '../_shared/run-agent.mjs';

const INBOX_ROOT = '/whatsapp/inbox';
const CHANNELS_FILE = path.join(INBOX_ROOT, 'channels.json');

const readJson = async (filePath) => {
  const raw = await fs.readFile(filePath, 'utf8');

  return JSON.parse(raw);
};

const loadChannels = async () => {
  try {
    const parsed = await readJson(CHANNELS_FILE);

    return Array.isArray(parsed.channels) ? parsed.channels : [];
  } catch {
    return [];
  }
};

const readMessagesFile = async (folder) => {
  const filePath = path.join(INBOX_ROOT, folder, 'messages.jsonl');

  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const lines = raw.split('\n').map((line) => line.trim()).filter(Boolean);
    const messages = [];

    for (const line of lines) {
      try {
        messages.push(JSON.parse(line));
      } catch {
        messages.push({ body: line, parseError: true });
      }
    }

    return { filePath, messages, raw };
  } catch {
    return { filePath, messages: [], raw: '' };
  }
};

const clearMessagesFile = async (folder) => {
  const filePath = path.join(INBOX_ROOT, folder, 'messages.jsonl');

  try {
    await fs.writeFile(filePath, '', 'utf8');
    return { cleared: true, filePath };
  } catch {
    return { cleared: false, filePath };
  }
};

const toMarkdown = (channel, messages) => {
  const lines = [
    `# WhatsApp inbox — ${channel.displayName || channel.folder}`,
    '',
    `- chatId: ${channel.chatId}`,
    `- folder: ${channel.folder}`,
    `- count: ${messages.length}`,
    '',
  ];

  for (const message of messages) {
    lines.push(`## ${message.ts ?? 'unknown'} — ${message.from ?? 'unknown'}`);
    lines.push('');
    lines.push(String(message.body ?? ''));
    lines.push('');
  }

  return `${lines.join('\n').trim()}\n`;
};

const main = async () => {
  const workspace = '/workspace';
  const defRoot = '/opt/nixery/def';
  const defId = resolveDefId(defRoot);
  const input = await readJson(path.join(workspace, 'input.json'));
  const outputName = typeof input.output === 'string' && input.output.trim()
    ? input.output.trim()
    : 'result.json';
  const action = String(input.action ?? '').trim();
  const folderFilter = typeof input.folder === 'string' ? input.folder.trim() : '';

  if (action !== 'read' && action !== 'clear' && action !== 'list') {
    throw new Error('action must be read, clear, or list');
  }

  const channels = await loadChannels();
  const selected = folderFilter
    ? channels.filter((channel) => channel.folder === folderFilter)
    : channels;

  logProgress(defId, `action=${action} channels=${selected.length}`);

  if (action === 'list') {
    const result = { ok: true, channels: selected };

    await fs.writeFile(path.join(workspace, outputName), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
    return;
  }

  if (action === 'read') {
    const batches = [];

    for (const channel of selected) {
      const { messages, raw } = await readMessagesFile(channel.folder);
      const mdName = `inbox-${channel.folder}.md`;

      await fs.writeFile(path.join(workspace, mdName), toMarkdown(channel, messages), 'utf8');
      batches.push({
        channel,
        count: messages.length,
        markdown: mdName,
        empty: messages.length === 0,
        preview: raw.slice(0, 500),
      });
    }

    const result = { ok: true, batches };

    await fs.writeFile(path.join(workspace, outputName), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
    await fs.writeFile(
      path.join(workspace, 'inbox-batches.json'),
      `${JSON.stringify(batches, null, 2)}\n`,
      'utf8',
    );
    return;
  }

  const cleared = [];

  for (const channel of selected) {
    cleared.push({
      channel,
      ...(await clearMessagesFile(channel.folder)),
    });
  }

  const result = { ok: true, cleared };

  await fs.writeFile(path.join(workspace, outputName), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  logProgress(defId, `cleared=${cleared.length}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
