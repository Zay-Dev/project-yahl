import fs from 'node:fs/promises';
import path from 'node:path';

import { logProgress, resolveDefId } from '../lib/run-agent.mjs';

const INBOX_ROOT = '/whatsapp/inbox';
const CHANNELS_FILE = path.join(INBOX_ROOT, 'channels.json');

const readJson = async (filePath) => {
  const raw = await fs.readFile(filePath, 'utf8');

  return JSON.parse(raw);
};

const stripDigits = (value) => String(value ?? '').replace(/\D/g, '');

const idsMatch = (left, right) => {
  const a = String(left ?? '').trim().toLowerCase();
  const b = String(right ?? '').trim().toLowerCase();

  if (!a || !b) {
    return false;
  }

  if (a === b) {
    return true;
  }

  const da = stripDigits(a.split('@')[0]);
  const db = stripDigits(b.split('@')[0]);

  if (!da || !db) {
    return false;
  }

  return da === db || da.endsWith(db) || db.endsWith(da);
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

const clearAttachmentsDir = async (folder) => {
  const attachmentsRoot = path.join(INBOX_ROOT, folder, 'attachments');

  try {
    await fs.rm(attachmentsRoot, { force: true, recursive: true });
    return { attachmentsCleared: true };
  } catch {
    return { attachmentsCleared: false };
  }
};

const clearMessagesFile = async (folder) => {
  const filePath = path.join(INBOX_ROOT, folder, 'messages.jsonl');

  try {
    await fs.writeFile(filePath, '', 'utf8');
    const attachments = await clearAttachmentsDir(folder);

    return { cleared: true, filePath, ...attachments };
  } catch {
    return { cleared: false, filePath, attachmentsCleared: false };
  }
};

const formatSender = (message, platform) => {
  const from = message.from ?? 'unknown';
  const name = platform?.displayName?.trim() || 'YAHL';
  const isPlatform = message.fromMe === true
    || (platform?.chatId && idsMatch(from, platform.chatId))
    || (platform?.lid && String(from).trim().toLowerCase() === String(platform.lid).trim().toLowerCase());

  if (isPlatform) {
    return `${name} (platform)`;
  }

  return from;
};

const materializeAttachment = async (folder, message, attachment) => {
  if (!attachment || typeof attachment !== 'object') {
    return null;
  }

  const kind = typeof attachment.kind === 'string' ? attachment.kind : 'unknown';
  const mime = typeof attachment.mime === 'string' ? attachment.mime : '';
  const filename = typeof attachment.filename === 'string' && attachment.filename.trim()
    ? attachment.filename.trim()
    : 'attachment';
  const status = typeof attachment.status === 'string' ? attachment.status : '';
  const relativePath = typeof attachment.relativePath === 'string'
    ? attachment.relativePath.trim()
    : '';

  if (status !== 'stored' || !relativePath) {
    const reason = typeof attachment.reason === 'string' ? attachment.reason : status || 'missing';

    return {
      kind,
      line: `[attachment kind=${kind} mime=${mime} name=${filename} status=${status || 'missing'} reason=${reason}]`,
      path: '',
    };
  }

  const pathParts = relativePath.split(/[/\\]/).filter(Boolean);
  const safeId = pathParts.length >= 2
    ? pathParts[pathParts.length - 2]
    : 'unknown';
  const fileName = pathParts.length >= 1
    ? pathParts[pathParts.length - 1]
    : filename;
  const workspaceRel = path.join('inbox-attachments', folder, safeId, fileName);
  const src = path.join(INBOX_ROOT, folder, relativePath);
  const dest = path.join('/workspace', workspaceRel);

  try {
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.copyFile(src, dest);

    const sessionPath = `~/nixery/whatsapp-inbox/${workspaceRel.split(path.sep).join('/')}`;

    return {
      kind,
      line: `[attachment kind=${kind} mime=${mime} path=${sessionPath} name=${filename}]`,
      path: sessionPath,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);

    return {
      kind,
      line: `[attachment kind=${kind} mime=${mime} name=${filename} status=copy_failed reason=${reason}]`,
      path: '',
    };
  }
};

const toMarkdown = async (channel, messages, platform) => {
  const lines = [
    `# WhatsApp inbox — ${channel.displayName || channel.folder}`,
    '',
    `- chatId: ${channel.chatId}`,
    `- folder: ${channel.folder}`,
    `- count: ${messages.length}`,
  ];

  if (platform?.chatId) {
    lines.push(`- platform: ${platform.displayName || 'YAHL'} (${platform.chatId}${platform.lid ? `, ${platform.lid}` : ''})`);
  }

  lines.push('');

  for (const message of messages) {
    lines.push(`## ${message.ts ?? 'unknown'} — ${formatSender(message, platform)}`);
    lines.push('');

    const body = String(message.body ?? '').trim();

    if (body) {
      lines.push(body);
      lines.push('');
    }

    const attachments = Array.isArray(message.attachments) ? message.attachments : [];

    for (const attachment of attachments) {
      const materialized = await materializeAttachment(channel.folder, message, attachment);

      if (materialized?.line) {
        lines.push(materialized.line);
        lines.push('');
      }
    }
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

  const { channels, platform } = await loadChannelsFile();
  const selected = folderFilter
    ? channels.filter((channel) => channel.folder === folderFilter)
    : channels;

  logProgress(defId, `action=${action} channels=${selected.length}`);

  if (action === 'list') {
    const result = { ok: true, channels: selected, platform };

    await fs.writeFile(path.join(workspace, outputName), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
    return;
  }

  if (action === 'read') {
    const batches = [];

    for (const channel of selected) {
      const { messages, raw } = await readMessagesFile(channel.folder);
      const mdName = `inbox-${channel.folder}.md`;
      const markdown = await toMarkdown(channel, messages, platform);

      await fs.writeFile(path.join(workspace, mdName), markdown, 'utf8');
      batches.push({
        channel,
        count: messages.length,
        markdown: mdName,
        empty: messages.length === 0,
        preview: raw.slice(0, 500),
      });
    }

    const result = { ok: true, batches, platform };

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
