import type { TModelResponse } from '@/shared/transports/-types';
import type { NormalizedUsage } from '@/shared/usage';

import { normalizeUsage } from '@/shared/usage';

export type TTokenTotals = NormalizedUsage;

type TPushRequestEnvelope = {
  context: Record<string, unknown>;
  currentStage: string;
  loopMeta?: {
    arraySnapshot: unknown[];
    index: number;
    temperature?: number;
    value: unknown;
  };
  requestId: string;
  temperature?: number;
};

type TToolCallEnvelope = {
  requestId: string;
  toolCalls: Record<string, unknown>[];
};

type TModelResponseEnvelope = {
  requestId: string;
  response: TModelResponse;
};

type TStageFinishEnvelope = {
  contextAfter: Record<string, unknown>;
  requestId: string;
};

const emptyUsage = (): TTokenTotals => ({
  cacheHitTokens: 0,
  cacheMissTokens: 0,
  completionTokens: 0,
  promptTokens: 0,
  reasoningTokens: 0,
  totalTokens: 0,
});

const addUsage = (totals: TTokenTotals, usage: NormalizedUsage) => {
  totals.cacheHitTokens += usage.cacheHitTokens;
  totals.cacheMissTokens += usage.cacheMissTokens;
  totals.completionTokens += usage.completionTokens;
  totals.promptTokens += usage.promptTokens;
  totals.reasoningTokens += usage.reasoningTokens;
  totals.totalTokens += usage.totalTokens;
};

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, '');

const _request = async (url: string, init: RequestInit) => {
  try {
    const response = await fetch(url, {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...init.headers,
      },
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      console.warn(
        `[WARN] ${init.method ?? 'GET'} ${url} failed with ${response.status} ${response.statusText}: ${detail || '<empty body>'}\n`,
      );
    }
  } catch (error) {
    console.warn(`[WARN] failed ${init.method ?? 'GET'} ${url}: ${String(error)}\n`);
  }
};

const _post = (url: string, body: unknown) =>
  _request(url, { body: JSON.stringify(body), method: 'POST' });

const _patch = (url: string, body: unknown) =>
  _request(url, { body: JSON.stringify(body), method: 'PATCH' });

export const createSessionEventTracker = () => {
  const baseUrlRaw = process.env.SESSION_API_BASE_URL;
  const baseUrl = baseUrlRaw ? normalizeBaseUrl(baseUrlRaw) : 'http://localhost:4000';

  let queue: Promise<void> = Promise.resolve();
  const stageTotals = new Map<string, TTokenTotals>();
  const sessionTotals = emptyUsage();

  const enqueue = (fn: () => Promise<void>) => {
    queue = queue
      .then(fn)
      .catch((error: unknown) => {
        console.warn(`[WARN] session-event-tracker queue error: ${String(error)}\n`);
      });

    return queue;
  };

  const _stageKey = (sessionId: string, requestId: string) => `${sessionId}:${requestId}`;

  const _getStageTotals = (sessionId: string, requestId: string) => {
    const key = _stageKey(sessionId, requestId);
    const existing = stageTotals.get(key);

    if (existing) return existing;

    const totals = emptyUsage();
    stageTotals.set(key, totals);

    return totals;
  };

  const _recordUsage = (sessionId: string, requestId: string, usage: NormalizedUsage) => {
    addUsage(_getStageTotals(sessionId, requestId), usage);
    addUsage(sessionTotals, usage);
  };

  const registerSession = async (
    sessionId: string,
    opts: { taskYahlPath: string },
  ) => {
    if (!baseUrl) return;

    const url = `${baseUrl}/api/sessions/${encodeURIComponent(sessionId)}/register`;

    await _post(url, { taskYahlPath: opts.taskYahlPath });
  };

  const createStage = (sessionId: string, envelope: TPushRequestEnvelope) => {
    enqueue(async () => {
      if (!baseUrl) return;

      const url = `${baseUrl}/api/sessions/${encodeURIComponent(sessionId)}/stages`;

      await _post(url, {
        context: envelope.context,
        currentStage: envelope.currentStage,
        loopMeta: envelope.loopMeta,
        requestId: envelope.requestId,
        temperature: envelope.temperature,
      });
    });
  };

  const appendToolCall = (sessionId: string, envelope: TToolCallEnvelope) => {
    enqueue(async () => {
      if (!baseUrl) return;
      if (!envelope.toolCalls.length) return;

      const url = `${baseUrl}/api/sessions/${encodeURIComponent(sessionId)}` +
        `/stages/${encodeURIComponent(envelope.requestId)}/tool-calls`;

      await _post(url, { toolCalls: envelope.toolCalls });
    });
  };

  const appendModelResponse = (sessionId: string, envelope: TModelResponseEnvelope) => {
    const usage = normalizeUsage(envelope.response.usage as Parameters<typeof normalizeUsage>[0]);

    _recordUsage(sessionId, envelope.requestId, usage);

    enqueue(async () => {
      if (!baseUrl) return;

      const url = `${baseUrl}/api/sessions/${encodeURIComponent(sessionId)}` +
        `/stages/${encodeURIComponent(envelope.requestId)}/model-responses`;

      await _post(url, {
        durationMs: envelope.response.durationMs,
        response: envelope.response,
        thinkingMode: envelope.response.thinkingMode,
      });
    });
  };

  const patchStage = (sessionId: string, envelope: TStageFinishEnvelope) => {
    const key = _stageKey(sessionId, envelope.requestId);
    const tokenTotals = { ...(_getStageTotals(sessionId, envelope.requestId)) };

    stageTotals.delete(key);

    enqueue(async () => {
      if (!baseUrl) return;

      const url = `${baseUrl}/api/sessions/${encodeURIComponent(sessionId)}` +
        `/stages/${encodeURIComponent(envelope.requestId)}`;

      await _patch(url, {
        contextAfter: envelope.contextAfter,
        tokenTotals,
      });
    });
  };

  const patchSession = (
    sessionId: string,
    body: { result?: unknown; tokenTotals?: TTokenTotals },
  ) => {
    const tokenTotals = body.tokenTotals ?? { ...sessionTotals };

    enqueue(async () => {
      if (!baseUrl) return;

      const url = `${baseUrl}/api/sessions/${encodeURIComponent(sessionId)}`;

      await _patch(url, {
        ...(body.result !== undefined ? { result: body.result } : {}),
        tokenTotals,
      });
    });
  };

  const getSessionTokenTotals = () => ({ ...sessionTotals });

  return {
    appendModelResponse,
    appendToolCall,
    createStage,
    getSessionTokenTotals,
    patchSession,
    patchStage,
    registerSession,
  };
};
