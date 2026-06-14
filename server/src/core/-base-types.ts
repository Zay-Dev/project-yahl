import type { TSoftDeletable, TWithTimestamps } from '@omni-infra/types/entities';

export type { TSoftDeletable, TWithTimestamps } from '@omni-infra/types/entities';

export type TYahlDocument = TSoftDeletable & TWithTimestamps & {
  _id: string;
};
