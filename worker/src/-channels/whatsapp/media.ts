import type { Message } from 'whatsapp-web.js';

import { randomUUID } from 'node:crypto';
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

export type TStoreAttachmentResult = {
  attachment: TInboxAttachment;
  safeId: string;
};

const MAX_ATTACHMENT_BYTES = 32 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 60_000;
const DOWNLOAD_ATTEMPTS = 3;
const DOWNLOAD_RETRY_MS = 1_500;
const THUMBNAIL_WARN_BYTES = 8 * 1024;
const LOG_NAME_MAX = 80;
const LOG_REASON_MAX = 200;

type TMediaMeta = {
  bodyBase64?: string;
  filename?: string;
  filesize?: number;
  mimetype?: string;
};

type TMediaCandidate = {
  buf: Buffer;
  mediaFilename?: string;
  mime: string;
  source: 'download' | 'direct' | 'inline';
};

type TMediaDecryptDesc = {
  directPath: string;
  encFilehash?: string;
  filehash?: string;
  filename?: string;
  mediaKey: string;
  mediaKeyTimestamp?: number;
  mimetype?: string;
  type: string;
};

const truncateLog = (value: string, max: number): string => {
  const trimmed = value.trim();

  if (trimmed.length <= max) {
    return trimmed;
  }

  return `${trimmed.slice(0, max)}…`;
};

const sleep = (ms: number) => new Promise<void>((resolve) => {
  setTimeout(resolve, ms);
});

export const logSkippedWhatsAppMedia = (meta: TMediaMeta): void => {
  const name = truncateLog(meta.filename?.trim() || '(unnamed)', LOG_NAME_MAX);
  const size = typeof meta.filesize === 'number' ? String(meta.filesize) : 'unknown';

  console.log(`[worker][whatsapp] skip file name=${name} size=${size} mimetype=${meta.mimetype ?? ''}`);
};

export const logSkippedMediaFromMessage = (msg: Message): void => {
  const meta = mediaMetaFromMessage(msg);

  logSkippedWhatsAppMedia({
    filename: meta.filename || msg.type,
    filesize: meta.filesize,
    mimetype: meta.mimetype,
  });
};

const isSaneFilename = (raw: string): boolean => {
  const trimmed = raw.trim();

  if (!trimmed || trimmed.length > 180) {
    return false;
  }

  if (trimmed.startsWith('/9j/') || trimmed.startsWith('iVBOR') || trimmed.includes('\n')) {
    return false;
  }

  return true;
};

const sanitizeFilename = (raw: string): string => {
  const base = path.basename(raw).replace(/[^\w.\-()+ ]+/g, '_').trim();

  return base.slice(0, 180) || '';
};

const sanitizeMessageId = (messageId: string): string => {
  const trimmed = messageId.trim();

  if (!trimmed) {
    return '';
  }

  return trimmed.replace(/[^\w.\-]+/g, '_').slice(0, 120) || '';
};

export const resolveSafeMessageId = (msg: Message, messageId: string): string => {
  const fromId = sanitizeMessageId(messageId);

  if (fromId) {
    return fromId;
  }

  const from = typeof msg.from === 'string' ? msg.from : 'unknown';
  const ts = typeof msg.timestamp === 'number' ? String(msg.timestamp) : String(Date.now());

  return sanitizeMessageId(`${ts}-${from}`) || randomUUID();
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

const sniffImageMime = (buf: Buffer): string => {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg';
  }

  if (
    buf.length >= 8
    && buf[0] === 0x89
    && buf[1] === 0x50
    && buf[2] === 0x4e
    && buf[3] === 0x47
  ) {
    return 'image/png';
  }

  if (
    buf.length >= 6
    && buf[0] === 0x47
    && buf[1] === 0x49
    && buf[2] === 0x46
  ) {
    return 'image/gif';
  }

  if (
    buf.length >= 12
    && buf[0] === 0x52
    && buf[1] === 0x49
    && buf[2] === 0x46
    && buf[3] === 0x46
    && buf[8] === 0x57
    && buf[9] === 0x45
    && buf[10] === 0x42
    && buf[11] === 0x50
  ) {
    return 'image/webp';
  }

  return '';
};

const uuidFilename = (mime: string): string => `${randomUUID()}${extensionForMime(mime) || ''}`;

const resolveFilename = (params: {
  hintName?: string;
  mediaFilename?: string;
  mime: string;
}): string => {
  if (params.mediaFilename?.trim() && isSaneFilename(params.mediaFilename)) {
    const sanitized = sanitizeFilename(params.mediaFilename);

    if (sanitized) {
      return path.extname(sanitized)
        ? sanitized
        : `${sanitized}${extensionForMime(params.mime) || ''}`;
    }
  }

  if (params.hintName?.trim() && isSaneFilename(params.hintName)) {
    const sanitized = sanitizeFilename(params.hintName);

    if (sanitized) {
      return path.extname(sanitized)
        ? sanitized
        : `${sanitized}${extensionForMime(params.mime) || ''}`;
    }
  }

  return uuidFilename(params.mime);
};

const mediaMetaFromMessage = (msg: Message): TMediaMeta => {
  const data = (msg as Message & { _data?: Record<string, unknown> })._data ?? {};
  const filename = typeof data.filename === 'string' && isSaneFilename(data.filename)
    ? data.filename.trim()
    : undefined;
  const filesize = typeof data.size === 'number'
    ? data.size
    : typeof data.fileLength === 'number'
      ? data.fileLength
      : undefined;
  const mimetype = typeof data.mimetype === 'string' ? data.mimetype : undefined;
  const bodyBase64 = typeof data.body === 'string' && data.body.trim()
    ? data.body.trim()
    : undefined;

  return { bodyBase64, filename, filesize, mimetype };
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

const tryInlineBodyBuffer = (meta: TMediaMeta): TMediaCandidate | null => {
  if (!meta.bodyBase64) {
    return null;
  }

  try {
    const buf = Buffer.from(meta.bodyBase64, 'base64');
    const sniffed = sniffImageMime(buf);

    if (!sniffed || buf.length > MAX_ATTACHMENT_BYTES) {
      return null;
    }

    return { buf, mime: sniffed, source: 'inline' };
  } catch {
    return null;
  }
};

const readMediaDecryptDesc = (msg: Message): TMediaDecryptDesc | null => {
  const data = (msg as Message & { _data?: Record<string, unknown> })._data ?? {};
  const directPath = typeof data.directPath === 'string' ? data.directPath.trim() : '';
  const mediaKey = typeof msg.mediaKey === 'string' && msg.mediaKey.trim()
    ? msg.mediaKey.trim()
    : typeof data.mediaKey === 'string'
      ? data.mediaKey.trim()
      : '';
  const type = typeof msg.type === 'string' && msg.type.trim()
    ? msg.type.trim()
    : typeof data.type === 'string'
      ? data.type.trim()
      : '';

  if (!directPath || !mediaKey || !type) {
    return null;
  }

  return {
    directPath,
    encFilehash: typeof data.encFilehash === 'string' ? data.encFilehash : undefined,
    filehash: typeof data.filehash === 'string' ? data.filehash : undefined,
    filename: typeof data.filename === 'string' && isSaneFilename(data.filename)
      ? data.filename.trim()
      : undefined,
    mediaKey,
    mediaKeyTimestamp: typeof data.mediaKeyTimestamp === 'number'
      ? data.mediaKeyTimestamp
      : undefined,
    mimetype: typeof data.mimetype === 'string' ? data.mimetype : undefined,
    type,
  };
};

const tryDirectDecryptCandidate = async (
  msg: Message,
  hintMime: string,
): Promise<{ candidate: TMediaCandidate | null; error: string }> => {
  const desc = readMediaDecryptDesc(msg);

  if (!desc) {
    return { candidate: null, error: 'missing directPath/mediaKey for direct decrypt' };
  }

  const client = (msg as unknown as {
    client?: {
      pupPage?: {
        evaluate: (
          fn: (d: TMediaDecryptDesc) => Promise<{
            data: string;
            filename?: string;
            mimetype?: string;
          } | null>,
          arg: TMediaDecryptDesc,
        ) => Promise<{
          data: string;
          filename?: string;
          mimetype?: string;
        } | null>;
      };
    };
  }).client;
  const page = client?.pupPage;

  if (!page?.evaluate) {
    return { candidate: null, error: 'pupPage unavailable for direct decrypt' };
  }

  try {
    const result = await withTimeout(
      page.evaluate(async (mediaDesc: TMediaDecryptDesc) => {
        const win = globalThis as typeof globalThis & {
          WWebJS?: {
            arrayBufferToBase64Async: (buf: ArrayBuffer) => Promise<string>;
          };
          require: (name: string) => {
            downloadManager: {
              downloadAndMaybeDecrypt: (opts: Record<string, unknown>) => Promise<ArrayBuffer | null>;
            };
          };
        };

        const mockQpl = {
          addAnnotations() {
            return this;
          },
          addPoint() {
            return this;
          },
        };

        const decryptedMedia = await win
          .require('WAWebDownloadManager')
          .downloadManager.downloadAndMaybeDecrypt({
            directPath: mediaDesc.directPath,
            encFilehash: mediaDesc.encFilehash,
            filehash: mediaDesc.filehash,
            mediaKey: mediaDesc.mediaKey,
            mediaKeyTimestamp: mediaDesc.mediaKeyTimestamp,
            type: mediaDesc.type,
            signal: new AbortController().signal,
            downloadQpl: mockQpl,
          });

        if (!decryptedMedia) {
          return null;
        }

        const data = await win.WWebJS!.arrayBufferToBase64Async(decryptedMedia);

        return {
          data,
          filename: mediaDesc.filename,
          mimetype: mediaDesc.mimetype,
        };
      }, desc),
      DOWNLOAD_TIMEOUT_MS,
    );

    if (!result?.data) {
      return { candidate: null, error: 'direct decrypt returned empty' };
    }

    const buf = Buffer.from(result.data, 'base64');
    const sniffed = sniffImageMime(buf);
    const mime = sniffed
      || (result.mimetype || hintMime).trim().toLowerCase()
      || 'application/octet-stream';

    if (buf.length <= 0 || buf.length > MAX_ATTACHMENT_BYTES) {
      return {
        candidate: null,
        error: buf.length > MAX_ATTACHMENT_BYTES
          ? `direct decrypt exceeds max ${MAX_ATTACHMENT_BYTES} bytes`
          : 'direct decrypt returned empty buffer',
      };
    }

    return {
      candidate: {
        buf,
        mediaFilename: result.filename ?? desc.filename,
        mime: sniffed || mime,
        source: 'direct',
      },
      error: '',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const name = error instanceof Error && error.name ? error.name : '';

    return {
      candidate: null,
      error: name ? `${name}: ${message}` : message,
    };
  }
};

const tryDownloadCandidate = async (
  msg: Message,
  hintMime: string,
): Promise<{ candidate: TMediaCandidate | null; error: string }> => {
  let lastError = '';

  for (let attempt = 1; attempt <= DOWNLOAD_ATTEMPTS; attempt += 1) {
    try {
      const media = await withTimeout(msg.downloadMedia(), DOWNLOAD_TIMEOUT_MS);

      if (!media?.data) {
        lastError = 'download returned empty';
      } else {
        const buf = Buffer.from(media.data, 'base64');
        const sniffed = sniffImageMime(buf);
        const mime = sniffed
          || (media.mimetype || hintMime).trim().toLowerCase()
          || 'application/octet-stream';

        if (buf.length > 0 && buf.length <= MAX_ATTACHMENT_BYTES) {
          return {
            candidate: {
              buf,
              mediaFilename: media.filename ?? undefined,
              mime: sniffed || mime,
              source: 'download',
            },
            error: '',
          };
        }

        lastError = buf.length > MAX_ATTACHMENT_BYTES
          ? `download exceeds max ${MAX_ATTACHMENT_BYTES} bytes`
          : 'download returned empty buffer';
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const name = error instanceof Error && error.name ? error.name : '';

      lastError = name ? `${name}: ${message}` : message;
    }

    if (attempt < DOWNLOAD_ATTEMPTS) {
      console.warn(
        `[worker][whatsapp] downloadMedia retry ${attempt}/${DOWNLOAD_ATTEMPTS}`
        + ` ${truncateLog(lastError, LOG_REASON_MAX)}`,
      );
      await sleep(DOWNLOAD_RETRY_MS);
    }
  }

  return { candidate: null, error: lastError };
};

const pickBestCandidate = (
  ...candidates: Array<TMediaCandidate | null>
): TMediaCandidate | null => {
  let best: TMediaCandidate | null = null;

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    if (!best || candidate.buf.length > best.buf.length) {
      best = candidate;
    }
  }

  return best;
};

const persistAttachment = async (params: {
  buf: Buffer;
  folder: string;
  filename: string;
  kind: TInboxAttachmentKind;
  mime: string;
  safeId: string;
  source: 'download' | 'direct' | 'inline';
}): Promise<TInboxAttachment> => {
  if (params.buf.length > MAX_ATTACHMENT_BYTES) {
    logSkippedWhatsAppMedia({
      filename: params.filename,
      filesize: params.buf.length,
      mimetype: params.mime,
    });

    return {
      bytes: params.buf.length,
      filename: params.filename,
      kind: params.kind,
      mime: params.mime,
      reason: `exceeds max ${MAX_ATTACHMENT_BYTES} bytes`,
      relativePath: '',
      status: 'skipped',
    };
  }

  const relativePath = path.join('attachments', params.safeId, params.filename);
  const absDir = path.join(whatsappConfig.inboxRoot, params.folder, 'attachments', params.safeId);
  const absPath = path.join(absDir, params.filename);

  await mkdir(absDir, { recursive: true });
  await writeFile(absPath, params.buf);

  if (params.buf.length < THUMBNAIL_WARN_BYTES) {
    console.warn(
      `[worker][whatsapp] warn thumbnail-sized source=${params.source}`
      + ` bytes=${params.buf.length} path=${relativePath}`,
    );
  }

  console.log(
    `[worker][whatsapp] stored attachment folder=${params.folder}`
    + ` source=${params.source} kind=${params.kind} mime=${params.mime}`
    + ` bytes=${params.buf.length} path=${relativePath}`,
  );

  return {
    bytes: params.buf.length,
    filename: params.filename,
    kind: params.kind,
    mime: params.mime,
    relativePath,
    status: 'stored',
  };
};

export const storeWhatsAppAttachment = async (params: {
  folder: string;
  messageId: string;
  msg: Message;
}): Promise<TStoreAttachmentResult> => {
  const meta = mediaMetaFromMessage(params.msg);
  const hintMime = meta.mimetype?.trim().toLowerCase() || 'application/octet-stream';
  const kind = classifyKind(hintMime);
  const safeId = resolveSafeMessageId(params.msg, params.messageId);
  const hintName = meta.filename?.trim()
    ? sanitizeFilename(meta.filename)
    : undefined;

  if (typeof meta.filesize === 'number' && meta.filesize > MAX_ATTACHMENT_BYTES) {
    const filename = resolveFilename({ hintName, mime: hintMime });

    logSkippedWhatsAppMedia({ filename, filesize: meta.filesize, mimetype: hintMime });

    return {
      attachment: {
        bytes: meta.filesize,
        filename,
        kind,
        mime: hintMime,
        reason: `exceeds max ${MAX_ATTACHMENT_BYTES} bytes`,
        relativePath: '',
        status: 'skipped',
      },
      safeId,
    };
  }

  const { candidate: download, error: downloadError } = await tryDownloadCandidate(
    params.msg,
    hintMime,
  );
  const { candidate: direct, error: directError } = await tryDirectDecryptCandidate(
    params.msg,
    hintMime,
  );
  const inline = tryInlineBodyBuffer(meta);
  const best = pickBestCandidate(download, direct, inline);

  if (best) {
    const resolvedKind = classifyKind(best.mime);
    const filename = resolveFilename({
      hintName,
      mediaFilename: best.mediaFilename,
      mime: best.mime,
    });

    if (best.source === 'inline' && (download || direct)) {
      console.log(
        `[worker][whatsapp] attachment prefer ${best.source}`
        + ` bytes=${best.buf.length}`
        + ` downloadBytes=${download?.buf.length ?? 0}`
        + ` directBytes=${direct?.buf.length ?? 0}`,
      );
    } else if (best.source === 'direct' && download && direct && direct.buf.length > download.buf.length) {
      console.log(
        `[worker][whatsapp] attachment prefer direct over download`
        + ` directBytes=${direct.buf.length} downloadBytes=${download.buf.length}`,
      );
    }

    const attachment = await persistAttachment({
      buf: best.buf,
      folder: params.folder,
      filename,
      kind: resolvedKind,
      mime: best.mime,
      safeId,
      source: best.source,
    });

    return { attachment, safeId };
  }

  const failReason = [downloadError, directError].filter(Boolean).join(' | ')
    || 'download returned empty';

  console.warn(
    `[worker][whatsapp] attachment store failed ${truncateLog(failReason, LOG_REASON_MAX)}`,
  );

  const filename = resolveFilename({ hintName, mime: hintMime });

  logSkippedWhatsAppMedia({ filename, filesize: meta.filesize, mimetype: hintMime });

  return {
    attachment: {
      bytes: typeof meta.filesize === 'number' ? meta.filesize : 0,
      filename,
      kind,
      mime: hintMime,
      reason: failReason,
      relativePath: '',
      status: 'failed',
    },
    safeId,
  };
};
