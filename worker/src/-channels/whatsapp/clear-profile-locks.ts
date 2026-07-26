import { unlink } from 'node:fs/promises';
import path from 'node:path';

const LOCK_FILES = ['SingletonLock', 'SingletonCookie', 'SingletonSocket'] as const;

export const clearChromiumProfileLocks = async (sessionDir: string): Promise<void> => {
  for (const name of LOCK_FILES) {
    const filePath = path.join(sessionDir, name);

    try {
      await unlink(filePath);
      console.log(`[worker][whatsapp] removed stale profile lock ${name}`);
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error
        ? String((error as { code?: unknown }).code)
        : '';

      if (code !== 'ENOENT') {
        console.warn(`[worker][whatsapp] could not remove ${name}`, error);
      }
    }
  }
};
