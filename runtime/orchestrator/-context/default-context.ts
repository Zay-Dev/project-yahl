import type { TStorage } from '@/shared/transports/-types';

export const PLATFORM_CONTEXT_KEYS = ['today', 'now_iso'] as const;

export type TPlatformContextKey = typeof PLATFORM_CONTEXT_KEYS[number];

export const defaultContextValues = (): Record<TPlatformContextKey, string> => {
  const now = new Date();

  return {
    now_iso: now.toISOString(),
    today: now.toISOString().slice(0, 10),
  };
};

export const seedDefaultContext = (storage: TStorage) => {
  for (const [key, value] of Object.entries(defaultContextValues())) {
    storage.context.set(key, value);
  }
};
