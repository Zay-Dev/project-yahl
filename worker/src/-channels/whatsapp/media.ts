import type { Message } from 'whatsapp-web.js';

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
