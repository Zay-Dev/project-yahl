import type { TTokenTotals } from './-types';

import { Types } from 'mongoose';

import { modelModelResponse } from './models';

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

const accumulateResponseUsage = (
  totalsByKey: Map<string, TTokenTotals>,
  key: string,
  usage: unknown,
) => {
  const normalized = normalizeUsageToTokenTotals(usage);

  if (!normalized) {
    return;
  }

  const existing = totalsByKey.get(key) ?? emptyTokenTotals();

  addTokenTotals(existing, normalized);
  totalsByKey.set(key, existing);
};

const toNullableTotals = (totals: TTokenTotals | undefined) => {
  if (!totals || !hasTokenUsage(totals)) {
    return null;
  }

  return totals;
};

export const sumModelResponseUsagesByRequestId = async (
  sessionRef: Types.ObjectId,
  requestIds: string[],
) => {
  const totalsByRequestId = new Map<string, TTokenTotals>();

  if (requestIds.length === 0) {
    return new Map<string, TTokenTotals | null>();
  }

  const docs = await modelModelResponse
    .find({
      requestId: { $in: requestIds },
      session: sessionRef,
    })
    .select({ requestId: 1, response: 1 })
    .lean();

  docs.forEach((doc) => {
    const response = (doc.response ?? {}) as Record<string, unknown>;

    accumulateResponseUsage(totalsByRequestId, doc.requestId, response.usage);
  });

  const out = new Map<string, TTokenTotals | null>();

  requestIds.forEach((requestId) => {
    out.set(requestId, toNullableTotals(totalsByRequestId.get(requestId)));
  });

  return out;
};

export const sumModelResponseUsagesForSession = async (sessionRef: Types.ObjectId) => {
  const docs = await modelModelResponse
    .find({ session: sessionRef })
    .select({ response: 1 })
    .lean();

  const totals = emptyTokenTotals();

  docs.forEach((doc) => {
    const response = (doc.response ?? {}) as Record<string, unknown>;
    const normalized = normalizeUsageToTokenTotals(response.usage);

    if (normalized) {
      addTokenTotals(totals, normalized);
    }
  });

  return toNullableTotals(totals);
};

export const sumModelResponseUsagesBySessionRef = async (sessionRefs: Types.ObjectId[]) => {
  const out = new Map<string, TTokenTotals | null>();

  if (sessionRefs.length === 0) {
    return out;
  }

  const docs = await modelModelResponse
    .find({ session: { $in: sessionRefs } })
    .select({ response: 1, session: 1 })
    .lean();

  const totalsBySessionRef = new Map<string, TTokenTotals>();

  docs.forEach((doc) => {
    const sessionKey = String(doc.session);
    const response = (doc.response ?? {}) as Record<string, unknown>;

    accumulateResponseUsage(totalsBySessionRef, sessionKey, response.usage);
  });

  sessionRefs.forEach((sessionRef) => {
    const key = String(sessionRef);

    out.set(key, toNullableTotals(totalsBySessionRef.get(key)));
  });

  return out;
};
