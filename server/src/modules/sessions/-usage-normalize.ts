import type { TTokenTotals } from './-types';

import { Types } from 'mongoose';

import { modelModelResponse } from './models';

export type TNixeryUsageGroup = {
  defId: string;
  domains: string[];
  tokenTotals: TTokenTotals | null;
};

export type TModelUsageSummary = {
  domains: string[];
  tokenTotals: TTokenTotals | null;
};

export type TSessionUsageSummary = TModelUsageSummary & {
  lastModelResponseAt?: string;
  nixeryUsage: TNixeryUsageGroup[];
  stageTokenTotals: TTokenTotals | null;
};

export type TRequestIdUsageSummary = TModelUsageSummary & {
  lastModelDurationMs: number;
  lastModelResponseAt?: string;
  modelDurationMs: number;
};

type TUsageDoc = {
  createdAt?: Date | string;
  domain?: unknown;
  durationMs?: unknown;
  requestId?: string;
  response?: unknown;
  tags?: unknown;
};

const NIXERY_TAG_PREFIX = 'nixery:';

const num = (value: unknown) =>
  (typeof value === 'number' && Number.isFinite(value) ? value : 0);

export const normalizeUsageToTokenTotals = (usage: unknown): TTokenTotals | null => {
  if (!usage || typeof usage !== 'object' || Array.isArray(usage)) {
    return null;
  }

  const record = usage as Record<string, unknown>;
  const promptTokens = num(record.prompt_tokens);
  const completionTokens = num(record.completion_tokens);
  const totalTokens = num(record.total_tokens) || promptTokens + completionTokens;

  if (promptTokens === 0 && completionTokens === 0 && totalTokens === 0) {
    return null;
  }

  let cacheHitTokens = 0;
  let cacheMissTokens = 0;

  const promptDetails = record.prompt_tokens_details;

  if (promptDetails && typeof promptDetails === 'object' && !Array.isArray(promptDetails)) {
    const cached = num((promptDetails as Record<string, unknown>).cached_tokens);

    if (cached > 0) {
      cacheHitTokens = cached;
      cacheMissTokens = promptTokens - cacheHitTokens;
    }
  }

  if (!cacheHitTokens && !cacheMissTokens && promptTokens > 0) {
    cacheMissTokens = promptTokens;
  }

  const completionDetails = record.completion_tokens_details;
  let reasoningTokens = 0;

  if (completionDetails && typeof completionDetails === 'object' && !Array.isArray(completionDetails)) {
    reasoningTokens = num((completionDetails as Record<string, unknown>).reasoning_tokens);
  }

  return {
    cacheHitTokens,
    cacheMissTokens,
    completionTokens,
    promptTokens,
    reasoningTokens,
    totalTokens,
  };
};

export const emptyTokenTotals = (): TTokenTotals => ({
  cacheHitTokens: 0,
  cacheMissTokens: 0,
  completionTokens: 0,
  promptTokens: 0,
  reasoningTokens: 0,
  totalTokens: 0,
});

export const addTokenTotals = (into: TTokenTotals, usage: TTokenTotals) => {
  into.cacheHitTokens += usage.cacheHitTokens;
  into.cacheMissTokens += usage.cacheMissTokens;
  into.completionTokens += usage.completionTokens;
  into.promptTokens += usage.promptTokens;
  into.reasoningTokens += usage.reasoningTokens;
  into.totalTokens += usage.totalTokens;
};

const hasTokenUsage = (totals: TTokenTotals) =>
  totals.promptTokens > 0
  || totals.completionTokens > 0
  || totals.totalTokens > 0;

export const emptyUsageSummary = (): TModelUsageSummary => ({
  domains: [],
  tokenTotals: null,
});

export const emptyRequestIdUsageSummary = (): TRequestIdUsageSummary => ({
  domains: [],
  lastModelDurationMs: 0,
  modelDurationMs: 0,
  tokenTotals: null,
});

export const uniqueSortedDomains = (values: unknown[]) => {
  const set = new Set<string>();

  for (const value of values) {
    if (typeof value !== 'string') continue;

    const trimmed = value.trim();

    if (trimmed) set.add(trimmed);
  }

  return [...set].sort();
};

export const nixeryDefIdFromTags = (tags: unknown): string | null => {
  if (!Array.isArray(tags)) {
    return null;
  }

  for (const tag of tags) {
    if (typeof tag !== 'string') continue;
    if (!tag.startsWith(NIXERY_TAG_PREFIX)) continue;

    const defId = tag.slice(NIXERY_TAG_PREFIX.length).trim();

    if (defId) {
      return defId;
    }
  }

  return null;
};

const toIsoTime = (value: Date | string | undefined | null) => {
  if (!value) {
    return undefined;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value.toISOString();
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed.toISOString();
};

const maxIso = (left?: string, right?: string) => {
  if (!left) {
    return right;
  }

  if (!right) {
    return left;
  }

  return left >= right ? left : right;
};

type TUsageAccumulator = {
  domains: Map<string, Set<string>>;
  totals: Map<string, TTokenTotals>;
};

const createUsageAccumulator = (): TUsageAccumulator => ({
  domains: new Map(),
  totals: new Map(),
});

const accumulateResponseUsage = (
  acc: TUsageAccumulator,
  key: string,
  usage: unknown,
) => {
  const normalized = normalizeUsageToTokenTotals(usage);

  if (!normalized) {
    return;
  }

  const existing = acc.totals.get(key) ?? emptyTokenTotals();

  addTokenTotals(existing, normalized);
  acc.totals.set(key, existing);
};

const accumulateDomain = (
  acc: TUsageAccumulator,
  key: string,
  domain: unknown,
) => {
  if (typeof domain !== 'string') return;

  const trimmed = domain.trim();

  if (!trimmed) return;

  const existing = acc.domains.get(key) ?? new Set<string>();

  existing.add(trimmed);
  acc.domains.set(key, existing);
};

const toNullableTotals = (totals: TTokenTotals | undefined) => {
  if (!totals || !hasTokenUsage(totals)) {
    return null;
  }

  return totals;
};

const toUsageSummary = (
  acc: TUsageAccumulator,
  key: string,
): TModelUsageSummary => ({
  domains: uniqueSortedDomains([...(acc.domains.get(key) ?? [])]),
  tokenTotals: toNullableTotals(acc.totals.get(key)),
});

const responseUsageOf = (doc: TUsageDoc) => {
  const response = (doc.response ?? {}) as Record<string, unknown>;

  return response.usage;
};

export const summarizeSessionUsageFromDocs = (docs: TUsageDoc[]): TSessionUsageSummary => {
  const all = createUsageAccumulator();
  const nixery = createUsageAccumulator();
  const stages = createUsageAccumulator();
  const allKey = 'all';
  const stageKey = 'stages';
  let lastModelResponseAt: string | undefined;

  docs.forEach((doc) => {
    const usage = responseUsageOf(doc);
    const at = toIsoTime(doc.createdAt);

    lastModelResponseAt = maxIso(lastModelResponseAt, at);
    accumulateDomain(all, allKey, doc.domain);
    accumulateResponseUsage(all, allKey, usage);

    const defId = nixeryDefIdFromTags(doc.tags);

    if (defId) {
      accumulateDomain(nixery, defId, doc.domain);
      accumulateResponseUsage(nixery, defId, usage);
      return;
    }

    accumulateDomain(stages, stageKey, doc.domain);
    accumulateResponseUsage(stages, stageKey, usage);
  });

  const defIds = [...new Set([...nixery.totals.keys(), ...nixery.domains.keys()])].sort();
  const nixeryUsage = defIds
    .map((defId) => ({
      defId,
      ...toUsageSummary(nixery, defId),
    }))
    .filter((group) => group.tokenTotals || group.domains.length > 0);

  return {
    domains: uniqueSortedDomains([...(all.domains.get(allKey) ?? [])]),
    ...(lastModelResponseAt ? { lastModelResponseAt } : {}),
    nixeryUsage,
    stageTokenTotals: toNullableTotals(stages.totals.get(stageKey)),
    tokenTotals: toNullableTotals(all.totals.get(allKey)),
  };
};

export const summarizeRequestIdUsagesFromDocs = (
  docs: TUsageDoc[],
  requestIds: string[],
) => {
  const acc = createUsageAccumulator();
  const duration = new Map<string, number>();
  const lastAt = new Map<string, string>();
  const lastDuration = new Map<string, number>();
  const out = new Map<string, TRequestIdUsageSummary>();

  docs.forEach((doc) => {
    const requestId = doc.requestId;

    if (!requestId) {
      return;
    }

    accumulateDomain(acc, requestId, doc.domain);
    accumulateResponseUsage(acc, requestId, responseUsageOf(doc));

    const ms = num(doc.durationMs);

    duration.set(requestId, (duration.get(requestId) ?? 0) + ms);

    const at = toIsoTime(doc.createdAt);

    if (!at) {
      return;
    }

    const previous = lastAt.get(requestId);

    if (!previous || at >= previous) {
      lastAt.set(requestId, at);
      lastDuration.set(requestId, ms);
    }
  });

  requestIds.forEach((requestId) => {
    const lastModelResponseAt = lastAt.get(requestId);

    out.set(requestId, {
      ...toUsageSummary(acc, requestId),
      lastModelDurationMs: lastDuration.get(requestId) ?? 0,
      ...(lastModelResponseAt ? { lastModelResponseAt } : {}),
      modelDurationMs: duration.get(requestId) ?? 0,
    });
  });

  return out;
};

export const sumModelResponseUsagesByRequestId = async (
  sessionRef: Types.ObjectId,
  requestIds: string[],
) => {
  const out = new Map<string, TRequestIdUsageSummary>();

  if (requestIds.length === 0) {
    return out;
  }

  const docs = await modelModelResponse
    .find({
      requestId: { $in: requestIds },
      session: sessionRef,
    })
    .select({ createdAt: 1, domain: 1, durationMs: 1, requestId: 1, response: 1 })
    .lean();

  return summarizeRequestIdUsagesFromDocs(docs, requestIds);
};

export const sumModelResponseUsagesForSession = async (sessionRef: Types.ObjectId) => {
  const docs = await modelModelResponse
    .find({ session: sessionRef })
    .select({ createdAt: 1, domain: 1, response: 1, tags: 1 })
    .lean();

  return summarizeSessionUsageFromDocs(docs);
};

export const sumModelResponseUsagesBySessionRef = async (sessionRefs: Types.ObjectId[]) => {
  const out = new Map<string, TModelUsageSummary>();

  if (sessionRefs.length === 0) {
    return out;
  }

  const docs = await modelModelResponse
    .find({ session: { $in: sessionRefs } })
    .select({ domain: 1, response: 1, session: 1 })
    .lean();

  const acc = createUsageAccumulator();

  docs.forEach((doc) => {
    const sessionKey = String(doc.session);

    accumulateDomain(acc, sessionKey, doc.domain);
    accumulateResponseUsage(acc, sessionKey, responseUsageOf(doc));
  });

  sessionRefs.forEach((sessionRef) => {
    const key = String(sessionRef);

    out.set(key, toUsageSummary(acc, key));
  });

  return out;
};
