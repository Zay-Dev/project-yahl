export type TContextBucket = "context" | "stage" | "types";

export const CONTEXT_BUCKETS: TContextBucket[] = ["context", "stage", "types"];

export type TContextDiffKind = "added" | "changed" | "removed" | "unchanged";

export type TContextDiffEntry = {
  after: unknown;
  before: unknown;
  kind: TContextDiffKind;
  path: string;
};

export type TStageMutationKeys = {
  produceContextKeys?: string[];
  produceTypeKeys?: string[];
  updateContextKeys?: string[];
};

const topLevelKey = (path: string) => path.split(".")[0] ?? path;

const mutationKeysForBucket = (
  bucket: TContextBucket,
  keys: TStageMutationKeys,
) => {
  const update = keys.updateContextKeys ?? [];
  const produce = bucket === "types"
    ? (keys.produceTypeKeys ?? [])
    : (keys.produceContextKeys ?? []);
  const combined = [...update, ...produce];

  if (combined.length === 0) {
    return undefined;
  }

  return new Set(combined);
};

const isStageMutationPath = (path: string, mutationAllow: Set<string> | undefined) => {
  if (!mutationAllow) {
    return true;
  }

  return mutationAllow.has(topLevelKey(path));
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const stableStringify = (value: unknown) => {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const valuesEqual = (left: unknown, right: unknown) => stableStringify(left) === stableStringify(right);

const flattenObject = (
  value: unknown,
  prefix: string,
  out: Map<string, unknown>,
) => {
  if (!isRecord(value)) {
    out.set(prefix || ".", value);

    return;
  }

  const keys = Object.keys(value).sort();

  if (keys.length === 0) {
    out.set(prefix || ".", value);

    return;
  }

  keys.forEach((key) => {
    const nextPath = prefix ? `${prefix}.${key}` : key;

    flattenObject(value[key], nextPath, out);
  });
};

export const bucketFromPayload = (
  payload: Record<string, unknown> | undefined,
  bucket: TContextBucket,
) => {
  if (!payload) {
    return {};
  }

  const value = payload[bucket];

  return isRecord(value) ? value : {};
};

export const diffContextBucket = (
  beforePayload: Record<string, unknown> | undefined,
  afterPayload: Record<string, unknown> | undefined,
  bucket: TContextBucket,
): TContextDiffEntry[] => {
  const beforeFlat = new Map<string, unknown>();
  const afterFlat = new Map<string, unknown>();

  flattenObject(bucketFromPayload(beforePayload, bucket), "", beforeFlat);
  flattenObject(bucketFromPayload(afterPayload, bucket), "", afterFlat);

  const paths = new Set([...beforeFlat.keys(), ...afterFlat.keys()]);
  const entries: TContextDiffEntry[] = [];

  [...paths].sort().forEach((path) => {
    const before = beforeFlat.get(path);
    const after = afterFlat.get(path);
    const hasBefore = beforeFlat.has(path);
    const hasAfter = afterFlat.has(path);

    if (hasBefore && hasAfter) {
      entries.push({
        after,
        before,
        kind: valuesEqual(before, after) ? "unchanged" : "changed",
        path,
      });

      return;
    }

    if (hasBefore) {
      entries.push({ after: undefined, before, kind: "removed", path });

      return;
    }

    entries.push({ after, before: undefined, kind: "added", path });
  });

  return entries;
};

export const diffContextBucketWithBaseline = (
  beforePayload: Record<string, unknown> | undefined,
  afterPayload: Record<string, unknown> | undefined,
  bucket: TContextBucket,
  baselinePayload?: Record<string, unknown>,
  mutationKeys?: TStageMutationKeys,
): TContextDiffEntry[] => {
  const beforeFlat = new Map<string, unknown>();
  const afterFlat = new Map<string, unknown>();
  const baselineFlat = new Map<string, unknown>();
  const mutationAllow = mutationKeys
    ? mutationKeysForBucket(bucket, mutationKeys)
    : undefined;

  flattenObject(bucketFromPayload(beforePayload, bucket), "", beforeFlat);
  flattenObject(bucketFromPayload(afterPayload, bucket), "", afterFlat);
  flattenObject(bucketFromPayload(baselinePayload, bucket), "", baselineFlat);

  const paths = new Set([...beforeFlat.keys(), ...afterFlat.keys()]);
  const entries: TContextDiffEntry[] = [];

  const resolveBefore = (path: string) => {
    if (beforeFlat.has(path)) {
      return beforeFlat.get(path);
    }

    if (baselineFlat.has(path)) {
      return baselineFlat.get(path);
    }

    return undefined;
  };

  const unchangedEntry = (path: string, after: unknown, carriedBefore: unknown) => ({
    after,
    before: carriedBefore ?? after,
    kind: "unchanged" as const,
    path,
  });

  [...paths].sort().forEach((path) => {
    const after = afterFlat.get(path);
    const hasAfter = afterFlat.has(path);
    const carriedBefore = resolveBefore(path);
    const hasEffectiveBefore = beforeFlat.has(path) || baselineFlat.has(path);

    if (!isStageMutationPath(path, mutationAllow)) {
      if (hasAfter) {
        entries.push(unchangedEntry(path, after, carriedBefore));
      }

      return;
    }

    if (hasEffectiveBefore && hasAfter) {
      entries.push({
        after,
        before: carriedBefore,
        kind: valuesEqual(carriedBefore, after) ? "unchanged" : "changed",
        path,
      });

      return;
    }

    if (hasEffectiveBefore && !hasAfter) {
      entries.push({ after: undefined, before: carriedBefore, kind: "removed", path });

      return;
    }

    entries.push({ after, before: undefined, kind: "added", path });
  });

  return entries;
};
