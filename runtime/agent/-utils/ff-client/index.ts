import type { TStorage } from '@/shared/transports/-types';

export type TContextBuckets = {
  context: Record<string, unknown>;
  types: Record<string, unknown>;
};

export const fastForward = async (snapshot: TStorage): Promise<TContextBuckets> => {
  const cloned = JSON.parse(JSON.stringify({
    context: Object.fromEntries(snapshot.context),
    types: Object.fromEntries(snapshot.types),
  })) as TContextBuckets;

  return {
    context: cloned.context ?? {},
    types: cloned.types ?? {},
  };
};
