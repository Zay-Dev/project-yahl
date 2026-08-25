import type { Message } from 'whatsapp-web.js';

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { whatsappConfig } from './config.js';

export type TInboxAttachmentKind = 'image' | 'document' | 'audio' | 'video' | 'unknown';

export type TInboxAttachmentStatus = 'stored' | 'skipped' | 'failed';

export type TInboxAttachment = {
  bytes: number;
  filename: string;
  kind: TInboxAttachmentKind;
  mime: string;
  reason?: string;
  relativePath: string;
  status: TInboxAttachmentStatus;
};

const MAX_ATTACHMENT_BYTES = 32 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 60_000;

type TMediaMeta = {
  filename?: string;
  filesize?: number;
  mimetype?: string;
};

export const logSkippedWhatsAppMedia = (meta: TMediaMeta): void => {
  const name = meta.filename?.trim() || '(unnamed)';
  const size = typeof meta.filesize === 'number' ? String(meta.filesize) : 'unknown';

  console.log(`[worker][whatsapp] skip file name=${name} size=${size} mimetype=${meta.mimetype ?? ''}`);
};

export const logSkippedMediaFromMessage = (msg: Message): void => {
  const data = (msg as Message & { _data?: Record<string, unknown> })._data ?? {};
  const filename = typeof data.filename === 'string'
    ? data.filename
    : typeof data.body === 'string' && data.body.trim()
      ? data.body.trim()
      : msg.type;
  const filesize = typeof data.size === 'number'
    ? data.size
    : typeof data.fileLength === 'number'
      ? data.fileLength
      : undefined;
  const mimetype = typeof data.mimetype === 'string' ? data.mimetype : undefined;

  logSkippedWhatsAppMedia({ filename, filesize, mimetype });
};

const sanitizeFilename = (raw: string): string => {
  const base = path.basename(raw).replace(/[^\w.\-()+ ]+/g, '_').trim();

  return base.slice(0, 180) || 'attachment';
};

const sanitizeMessageId = (messageId: string): string => {
  const trimmed = messageId.trim() || 'unknown';

  return trimmed.replace(/[^\w.\-]+/g, '_').slice(0, 120) || 'unknown';
};

const extensionForMime = (mime: string): string => {
  const map: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'application/pdf': '.pdf',
    'audio/ogg': '.ogg',
    'audio/mpeg': '.mp3',
    'video/mp4': '.mp4',
  };

  return map[mime] ?? '';
};

const classifyKind = (mime: string): TInboxAttachmentKind => {
  if (
    mime === 'image/jpeg'
    || mime === 'image/jpg'
    || mime === 'image/png'
    || mime === 'image/gif'
    || mime === 'image/webp'
  ) {
    return 'image';
  }

  if (mime.startsWith('image/') || mime.startsWith('application/') || mime.startsWith('text/')) {
    return 'document';
  }

  if (mime.startsWith('audio/')) {
    return 'audio';
  }

  if (mime.startsWith('video/')) {
    return 'video';
  }

  return 'unknown';
};

const mediaMetaFromMessage = (msg: Message): TMediaMeta => {
  const data = (msg as Message & { _data?: Record<string, unknown> })._data ?? {};
  const filename = typeof data.filename === 'string'
    ? data.filename
    : typeof data.body === 'string' && data.body.trim()
      ? data.body.trim()
      : undefined;
  const filesize = typeof data.size === 'number'
    ? data.size
    : typeof data.fileLength === 'number'
      ? data.fileLength
      : undefined;
  const mimetype = typeof data.mimetype === 'string' ? data.mimetype : undefined;

  return { filename, filesize, mimetype };
};

const withTimeout = async <T>(promise: Promise<T>, ms: number): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`download timed out after ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
};

export const storeWhatsAppAttachment = async (params: {
  folder: string;
  messageId: string;
  msg: Message;
}): Promise<TInboxAttachment> => {
  const meta = mediaMetaFromMessage(params.msg);
  const hintMime = meta.mimetype?.trim().toLowerCase() || 'application/octet-stream';
  const kind = classifyKind(hintMime);
  const safeId = sanitizeMessageId(params.messageId);
  const hintName = meta.filename?.trim()
    ? sanitizeFilename(meta.filename)
    : `attachment${extensionForMime(hintMime)}`;

  if (typeof meta.filesize === 'number' && meta.filesize > MAX_ATTACHMENT_BYTES) {
    logSkippedWhatsAppMedia(meta);

    return {
      bytes: meta.filesize,
      filename: hintName,
      kind,
      mime: hintMime,
      reason: `exceeds max ${MAX_ATTACHMENT_BYTES} bytes`,
      relativePath: '',
      status: 'skipped',
    };
  }

  try {
    const media = await withTimeout(params.msg.downloadMedia(), DOWNLOAD_TIMEOUT_MS);

    if (!media?.data) {
      return {
        bytes: 0,
        filename: hintName,
        kind,
        mime: hintMime,
        reason: 'download returned empty',
        relativePath: '',
        status: 'failed',
      };
    }

    const mime = (media.mimetype || hintMime).trim().toLowerCase() || 'application/octet-stream';
    const resolvedKind = classifyKind(mime);
    const filename = media.filename?.trim()
      ? sanitizeFilename(media.filename)
      : (path.extname(hintName)
        ? hintName
        : `${hintName}${extensionForMime(mime) || ''}`);
    const buf = Buffer.from(media.data, 'base64');

    if (buf.length > MAX_ATTACHMENT_BYTES) {
      logSkippedWhatsAppMedia({ ...meta, filesize: buf.length, mimetype: mime });

      return {
        bytes: buf.length,
        filename,
        kind: resolvedKind,
        mime,
        reason: `exceeds max ${MAX_ATTACHMENT_BYTES} bytes`,
        relativePath: '',
        status: 'skipped',
      };
    }

    const relativePath = path.join('attachments', safeId, filename);
    const absDir = path.join(whatsappConfig.inboxRoot, params.folder, 'attachments', safeId);
    const absPath = path.join(absDir, filename);

    await mkdir(absDir, { recursive: true });
    await writeFile(absPath, buf);

    console.log(
      `[worker][whatsapp] stored attachment folder=${params.folder}`
      + ` kind=${resolvedKind} mime=${mime} bytes=${buf.length} path=${relativePath}`,
    );

    return {
      bytes: buf.length,
      filename,
      kind: resolvedKind,
      mime,
      relativePath,
      status: 'stored',
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);

    console.warn('[worker][whatsapp] attachment store failed', reason);
    logSkippedWhatsAppMedia(meta);

    return {
      bytes: typeof meta.filesize === 'number' ? meta.filesize : 0,
      filename: hintName,
      kind,
      mime: hintMime,
      reason,
      relativePath: '',
      status: 'failed',
    };
  }
};
