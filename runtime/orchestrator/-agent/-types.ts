import type { TStorage, TLoopMeta } from '@/shared/transports/-types';
import type { ParsedStage } from '@/orchestrator/orchestrator-types';

export { TStorage, TLoopMeta };

export type TRunYahl = (
  yahl: string,
  options?: {
    loopMeta?: TLoopMeta;
    stages?: ParsedStage[];
    temperature?: number;
    useStorage?: () => TStorage
  },
) => Promise<{
  storage: TStorage;
}>;