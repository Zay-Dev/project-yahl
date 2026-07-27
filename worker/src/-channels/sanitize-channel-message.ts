import { fileURLToPath, pathToFileURL } from 'node:url';

import path from 'node:path';

const SANITIZE_MODULE_PATHS = [
  '/sanitize/sanitize-channel-message.mjs',
  path.join(path.dirname(fileURLToPath(import.meta.url)), '../../sanitize-channel-message.mjs'),
];

type TSanitizeChannelMessage = (
  message: Record<string, unknown>,
) => Promise<Record<string, unknown>> | Record<string, unknown>;

let loaded: TSanitizeChannelMessage | null = null;
let loadAttempted = false;

const loadSanitizer = async (): Promise<TSanitizeChannelMessage> => {
  if (loaded) {
    return loaded;
  }

  if (loadAttempted) {
    return async (message) => message;
  }

  loadAttempted = true;

  for (const modulePath of SANITIZE_MODULE_PATHS) {
    try {
      const href = pathToFileURL(path.resolve(modulePath)).href;
      const mod = await import(href) as {
        sanitizeChannelMessage?: TSanitizeChannelMessage;
        default?: TSanitizeChannelMessage | { sanitizeChannelMessage?: TSanitizeChannelMessage };
      };
      const candidate =
        mod.sanitizeChannelMessage
        ?? (typeof mod.default === 'function'
          ? mod.default
          : mod.default?.sanitizeChannelMessage);

      if (typeof candidate !== 'function') {
        continue;
      }

      loaded = candidate;
      return loaded;
    } catch {
      // try next path
    }
  }

  console.warn('[worker] failed to load sanitize-channel-message.mjs');
  loaded = async (message) => message;
  return loaded;
};

export const applyChannelMessageSanitizer = async <T extends Record<string, unknown>>(
  message: T,
): Promise<T> => {
  const sanitize = await loadSanitizer();
  const next = await sanitize(message);

  return (next && typeof next === 'object' ? next : message) as T;
};
