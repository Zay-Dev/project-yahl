import type { TStorage, TLoopMeta } from '@/shared/transports/-types';

export { TStorage, TLoopMeta };

export type TRunYahl = (
  yahl: string,
  options?: {
    loopMeta?: TLoopMeta;
    temperature?: number;
    useStorage?: () => TStorage
  },
) => Promise<{
  storage: TStorage;
}>;