import type { RuntimeBucket } from "../shared/stage-contract";

export type RuntimeContext = Map<RuntimeBucket, Record<string, unknown>>;
