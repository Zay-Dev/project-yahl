import type { TTokenTotals } from './-types';

import { Types } from 'mongoose';

import { modelModelResponse } from './models';

export type TModelUsageByModel = {
  domains: string[];
  model: string;
  tokenTotals: TTokenTotals | null;
};

export type TModelUsageSummary = {
  byModel: TModelUsageByModel[];
  domains: string[];
  tokenTotals: TTokenTotals | null;
};

export type TNixeryUsageGroup = TModelUsageSummary & {
  defId: string;
};

export type TSessionUsageSummary = TModelUsageSummary & {
  lastModelResponseAt?: string;
  nixeryUsage: TNixeryUsageGroup[];
  stageUsage: TModelUsageSummary;
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
const UNKNOWN_MODEL = 'unknown';

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
  byModel: [],
  domains: [],
  tokenTotals: null,
});

export const emptyRequestIdUsageSummary = (): TRequestIdUsageSummary => ({
  byModel: [],
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

type TModelBucket = {
  domains: Set<string>;
  totals: TTokenTotals;
};

type TUsageAccumulator = {
  byModel: Map<string, Map<string, TModelBucket>>;
  domains: Map<string, Set<string>>;
  totals: Map<string, TTokenTotals>;
};

const createUsageAccumulator = (): TUsageAccumulator => ({
  byModel: new Map(),
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

const accumulateByModel = (
  acc: TUsageAccumulator,
  key: string,
  model: string,
  domain: unknown,
  usage: unknown,
) => {
  const models = acc.byModel.get(key) ?? new Map<string, TModelBucket>();
  const existing = models.get(model) ?? {
    domains: new Set<string>(),
    totals: emptyTokenTotals(),
  };

  if (typeof domain === 'string') {
    const trimmed = domain.trim();

    if (trimmed) {
      existing.domains.add(trimmed);
    }
  }

  const normalized = normalizeUsageToTokenTotals(usage);

  if (normalized) {
    addTokenTotals(existing.totals, normalized);
  }

  if (existing.domains.size === 0 && !hasTokenUsage(existing.totals)) {
    return;
  }

  models.set(model, existing);
  acc.byModel.set(key, models);
};

const toNullableTotals = (totals: TTokenTotals | undefined) => {
  if (!totals || !hasTokenUsage(totals)) {
    return null;
  }

  return totals;
};

const toByModel = (acc: TUsageAccumulator, key: string): TModelUsageByModel[] => {
  const models = acc.byModel.get(key);

  if (!models) {
    return [];
  }

  return [...models.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([model, bucket]) => ({
      domains: uniqueSortedDomains([...bucket.domains]),
      model,
      tokenTotals: toNullableTotals(bucket.totals),
    }))
    .filter((row) => row.tokenTotals || row.domains.length > 0);
};

const toUsageSummary = (
  acc: TUsageAccumulator,
  key: string,
): TModelUsageSummary => ({
  byModel: toByModel(acc, key),
  domains: uniqueSortedDomains([...(acc.domains.get(key) ?? [])]),
  tokenTotals: toNullableTotals(acc.totals.get(key)),
});

const responseUsageOf = (doc: TUsageDoc) => {
  const response = (doc.response ?? {}) as Record<string, unknown>;

  return response.usage;
};

const responseModelOf = (doc: TUsageDoc) => {
  const response = (doc.response ?? {}) as Record<string, unknown>;
  const model = typeof response.model === 'string' ? response.model.trim() : '';

  return model || UNKNOWN_MODEL;
};

const accumulateDoc = (
  acc: TUsageAccumulator,
  key: string,
  doc: TUsageDoc,
) => {
  const usage = responseUsageOf(doc);

  accumulateDomain(acc, key, doc.domain);
  accumulateResponseUsage(acc, key, usage);
  accumulateByModel(acc, key, responseModelOf(doc), doc.domain, usage);
};

export const summarizeSessionUsageFromDocs = (docs: TUsageDoc[]): TSessionUsageSummary => {
  const all = createUsageAccumulator();
  const nixery = createUsageAccumulator();
  const stages = createUsageAccumulator();
  const allKey = 'all';
  const stageKey = 'stages';
  let lastModelResponseAt: string | undefined;

  docs.forEach((doc) => {
    const at = toIsoTime(doc.createdAt);

    lastModelResponseAt = maxIso(lastModelResponseAt, at);
    accumulateDoc(all, allKey, doc);

    const defId = nixeryDefIdFromTags(doc.tags);

    if (defId) {
      accumulateDoc(nixery, defId, doc);
      return;
    }

    accumulateDoc(stages, stageKey, doc);
  });

  const defIds = [...new Set([...nixery.totals.keys(), ...nixery.domains.keys()])].sort();
  const nixeryUsage = defIds
    .map((defId) => ({
      defId,
      ...toUsageSummary(nixery, defId),
    }))
    .filter((group) => group.tokenTotals || group.domains.length > 0 || group.byModel.length > 0);

  return {
    ...toUsageSummary(all, allKey),
    ...(lastModelResponseAt ? { lastModelResponseAt } : {}),
    nixeryUsage,
    stageUsage: toUsageSummary(stages, stageKey),
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

    accumulateDoc(acc, requestId, doc);

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

    accumulateDoc(acc, sessionKey, doc);
  });

  sessionRefs.forEach((sessionRef) => {
    const key = String(sessionRef);

    out.set(key, toUsageSummary(acc, key));
  });

  return out;
};
