import type { TTokenTotals } from './-types';

import { Types } from 'mongoose';

import { modelModelResponse } from './models';

export type TModelUsageSummary = {
  domains: string[];
  tokenTotals: TTokenTotals | null;
};

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

export const uniqueSortedDomains = (values: unknown[]) => {
  const set = new Set<string>();

  for (const value of values) {
    if (typeof value !== 'string') continue;

    const trimmed = value.trim();

    if (trimmed) set.add(trimmed);
  }

  return [...set].sort();
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

export const sumModelResponseUsagesByRequestId = async (
  sessionRef: Types.ObjectId,
  requestIds: string[],
) => {
  const out = new Map<string, TModelUsageSummary>();

  if (requestIds.length === 0) {
    return out;
  }

  const docs = await modelModelResponse
    .find({
      requestId: { $in: requestIds },
      session: sessionRef,
    })
    .select({ domain: 1, requestId: 1, response: 1 })
    .lean();

  const acc = createUsageAccumulator();

  docs.forEach((doc) => {
    const response = (doc.response ?? {}) as Record<string, unknown>;

    accumulateDomain(acc, doc.requestId, doc.domain);
    accumulateResponseUsage(acc, doc.requestId, response.usage);
  });

  requestIds.forEach((requestId) => {
    out.set(requestId, toUsageSummary(acc, requestId));
  });

  return out;
};

export const sumModelResponseUsagesForSession = async (sessionRef: Types.ObjectId) => {
  const docs = await modelModelResponse
    .find({ session: sessionRef })
    .select({ domain: 1, response: 1 })
    .lean();

  const acc = createUsageAccumulator();
  const key = String(sessionRef);

  docs.forEach((doc) => {
    const response = (doc.response ?? {}) as Record<string, unknown>;

    accumulateDomain(acc, key, doc.domain);
    accumulateResponseUsage(acc, key, response.usage);
  });

  return toUsageSummary(acc, key);
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
    const response = (doc.response ?? {}) as Record<string, unknown>;

    accumulateDomain(acc, sessionKey, doc.domain);
    accumulateResponseUsage(acc, sessionKey, response.usage);
  });

  sessionRefs.forEach((sessionRef) => {
    const key = String(sessionRef);

    out.set(key, toUsageSummary(acc, key));
  });

  return out;
};
