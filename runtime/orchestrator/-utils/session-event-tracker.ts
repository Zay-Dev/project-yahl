import type { TTaskSkillFile } from '@project-yahl/shared/yahl/task-skills';

import type { TModelResponse } from '@/shared/transports/-types';
import type { ParsedStage } from '@/orchestrator/-utils/yahl/types';
import type { YahlStage } from '@/shared/yahl-stage';

type TPushRequestEnvelope = {
  context: Record<string, unknown>;
  loopMeta?: {
    arraySnapshot: unknown[];
    index: number;
    temperature?: number;
    value: unknown;
  };
  parsedStageIndex?: number;
  requestId: string;
  sourceStartLine?: number;
  stage: YahlStage;
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

export class SessionEventTrackerError extends Error {
  constructor(
    message: string,
    readonly url: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'SessionEventTrackerError';
  }
}

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, '');

const _request = async (url: string, init: RequestInit) => {
  let response: Response;

  try {
    response = await fetch(url, {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...init.headers,
      },
    });
  } catch (error) {
    const message = `failed ${init.method ?? 'GET'} ${url}: ${String(error)}`;

    console.error(`[ERROR] session-event-tracker ${message}\n`);
    throw new SessionEventTrackerError(message, url);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    const message = `${init.method ?? 'GET'} ${url} failed with ${response.status} ${response.statusText}: ${detail || '<empty body>'}`;

    console.error(`[ERROR] session-event-tracker ${message}\n`);
    throw new SessionEventTrackerError(message, url, response.status);
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

  const enqueue = (fn: () => Promise<void>, critical = false) => {
    queue = queue
      .then(fn)
      .catch((error: unknown) => {
        console.error(`[ERROR] session-event-tracker queue error: ${String(error)}\n`);

        if (critical) {
          throw error;
        }
      });

    return queue;
  };

  const registerSession = async (
    sessionId: string,
    opts: {
      liveViewVncPort?: number;
      parsedStages: ParsedStage[];
      resultContextKey?: string;
      taskId: string;
      taskSkills: TTaskSkillFile[];
      taskYahl: string;
    },
  ) => {
    if (!baseUrl) return;

    const url = `${baseUrl}/api/sessions/${encodeURIComponent(sessionId)}/register`;

    await _post(url, {
      parsedStages: opts.parsedStages,
      taskId: opts.taskId,
      taskSkills: opts.taskSkills,
      taskYahl: opts.taskYahl,
      ...(opts.resultContextKey ? { resultContextKey: opts.resultContextKey } : {}),
      ...(opts.liveViewVncPort ? { liveViewVncPort: opts.liveViewVncPort } : {}),
    });
  };

  const createStage = (sessionId: string, envelope: TPushRequestEnvelope) => {
    enqueue(async () => {
      if (!baseUrl) return;

      const url = `${baseUrl}/api/sessions/${encodeURIComponent(sessionId)}/stages`;

      const temperature = envelope.temperature ?? envelope.stage.temperature;

      await _post(url, {
        context: envelope.context,
        loopMeta: envelope.loopMeta,
        parsedStageIndex: envelope.parsedStageIndex,
        requestId: envelope.requestId,
        sourceStartLine: envelope.sourceStartLine,
        stage: envelope.stage,
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
        tags: envelope.response.tags,
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
    }, true);
  };

  const patchSession = (
    sessionId: string,
    body: {
      liveViewVncPort?: number | null;
      result?: unknown;
      runCursor?: { kind: 'pipeline'; stageIndex: number; loopMeta?: unknown };
    },
  ) => {
    enqueue(async () => {
      if (!baseUrl) return;

      const url = `${baseUrl}/api/sessions/${encodeURIComponent(sessionId)}`;

      await _patch(url, {
        ...('result' in body ? { result: body.result } : {}),
        ...('liveViewVncPort' in body ? { liveViewVncPort: body.liveViewVncPort } : {}),
        ...('runCursor' in body ? { runCursor: body.runCursor } : {}),
      });
    });
  };

  const patchLiveViewVncPort = (sessionId: string, port: number | null) => {
    enqueue(async () => {
      if (!baseUrl) return;

      const url = `${baseUrl}/api/sessions/${encodeURIComponent(sessionId)}`;

      await _patch(url, { liveViewVncPort: port });
    }, true);

    return queue;
  };

  const flush = () => queue;

  return {
    appendModelResponse,
    appendToolCall,
    createStage,
    flush,
    patchLiveViewVncPort,
    patchSession,
    patchStage,
    registerSession,
  };
};
