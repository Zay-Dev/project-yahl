import type { TModelResponse } from '@/shared/transports/-types';
import type { ParsedStage } from '@/orchestrator/orchestrator-types';
import type { YahlStage } from '@/shared/yahl-stage';

type TPushRequestEnvelope = {
  context: Record<string, unknown>;
  stage: YahlStage;
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

  const enqueue = (fn: () => Promise<void>) => {
    queue = queue
      .then(fn)
      .catch((error: unknown) => {
        console.warn(`[WARN] session-event-tracker queue error: ${String(error)}\n`);
      });

    return queue;
  };

  const registerSession = async (
    sessionId: string,
    opts: { parsedStages?: ParsedStage[]; taskId: string; taskYahlPath: string },
  ) => {
    if (!baseUrl) return;

    const url = `${baseUrl}/api/sessions/${encodeURIComponent(sessionId)}/register`;

    await _post(url, {
      parsedStages: opts.parsedStages ?? [],
      taskId: opts.taskId,
      taskYahlPath: opts.taskYahlPath,
    });
  };

  const createStage = (sessionId: string, envelope: TPushRequestEnvelope) => {
    enqueue(async () => {
      if (!baseUrl) return;

      const url = `${baseUrl}/api/sessions/${encodeURIComponent(sessionId)}/stages`;

      const temperature = envelope.temperature ?? envelope.stage.temperature;

      await _post(url, {
        context: envelope.context,
        stage: envelope.stage,
        loopMeta: envelope.loopMeta,
        requestId: envelope.requestId,
        ...(temperature === undefined ? {} : { temperature }),
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
    enqueue(async () => {
      if (!baseUrl) return;

      const url = `${baseUrl}/api/sessions/${encodeURIComponent(sessionId)}` +
        `/stages/${encodeURIComponent(envelope.requestId)}`;

      await _patch(url, {
        contextAfter: envelope.contextAfter,
      });
    });
  };

  const patchSession = (
    sessionId: string,
    body: { result?: unknown },
  ) => {
    enqueue(async () => {
      if (!baseUrl) return;

      const url = `${baseUrl}/api/sessions/${encodeURIComponent(sessionId)}`;

      await _patch(url, {
        ...(body.result !== undefined ? { result: body.result } : {}),
      });
    });
  };

  const flush = () => queue;

  return {
    appendModelResponse,
    appendToolCall,
    createStage,
    flush,
    patchSession,
    patchStage,
    registerSession,
  };
};
