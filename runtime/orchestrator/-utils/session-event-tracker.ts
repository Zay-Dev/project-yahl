import type { TTaskSkillFile } from '@project-yahl/shared/yahl/task-skills';

import type { TModelResponse } from '@/shared/transports/-types';
import type { ParsedStage } from '@/orchestrator/-utils/yahl/types';
import type { YahlStage } from '@/shared/yahl-stage';

type TPushRequestEnvelope = {
  agentMeta?: {
    isMainThread: boolean;
    nestedIndex?: number;
    nestedPath?: string;
    parallelGroupId?: string;
    parallelSlot?: number;
    parentRequestId?: string;
  };
  context: Record<string, unknown>;
  loopMeta?: {
    arraySnapshot?: unknown[];
    index?: number;
    kind?: 'for' | 'warmup' | 'while';
    remainingBashCalls?: number;
    remainingTurns?: number;
    temperature?: number;
    value?: unknown;
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

type TToolCallResultEnvelope = {
  requestId: string;
  result: string;
  toolCallId: string;
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

const parseSessionIdFromUrl = (url: string) => {
  const match = url.match(/\/sessions\/([^/]+)/);

  return match?.[1];
};

const parseRequestIdFromUrl = (url: string) => {
  const match = url.match(/\/stages\/([^/]+)/);

  return match?.[1];
};

const isUndiciFetchError = (error: unknown) => {
  const text = String(error);

  if (text.includes('UND_ERR_')) {
    return true;
  }

  if (!(error instanceof Error) || !error.cause) {
    return false;
  }

  return String(error.cause).includes('UND_ERR_');
};

const _request = async (url: string, init: RequestInit) => {
  const sessionId = parseSessionIdFromUrl(url);
  const requestId = parseRequestIdFromUrl(url);
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
    const undiciHint = isUndiciFetchError(error) ? ' undici=yes' : '';

    console.error(
      `[ERROR] session-event-tracker ${message} sessionId=${sessionId ?? '-'} `
      + `requestId=${requestId ?? '-'}${undiciHint}\n`,
    );
    throw new SessionEventTrackerError(message, url);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    const message = `${init.method ?? 'GET'} ${url} failed with ${response.status} ${response.statusText}: ${detail || '<empty body>'}`;

    console.error(
      `[ERROR] session-event-tracker ${message} sessionId=${sessionId ?? '-'} `
      + `requestId=${requestId ?? '-'}\n`,
    );
    throw new SessionEventTrackerError(message, url, response.status);
  }
};

const _post = (url: string, body: unknown) =>
  _request(url, { body: JSON.stringify(body), method: 'POST' });

const _patch = (url: string, body: unknown) =>
  _request(url, { body: JSON.stringify(body), method: 'PATCH' });

import { truncateToolResult, TOOL_RESULT_PERSIST_MAX } from '@/shared/tool-result-truncate';

export { TOOL_RESULT_PERSIST_MAX, truncateToolResult };

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
        ...(envelope.agentMeta ? { agentMeta: envelope.agentMeta } : {}),
        context: envelope.context,
        loopMeta: envelope.loopMeta,
        parsedStageIndex: envelope.parsedStageIndex,
        requestId: envelope.requestId,
        sourceStartLine: envelope.sourceStartLine,
        stage: envelope.stage,
        ...(temperature === undefined ? {} : { temperature }),
      });
    }, true);
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

  const appendToolResult = (sessionId: string, envelope: TToolCallResultEnvelope) => {
    enqueue(async () => {
      if (!baseUrl) return;

      const content = truncateToolResult(envelope.result);

      if (!content) {
        return;
      }

      const url = `${baseUrl}/api/sessions/${encodeURIComponent(sessionId)}` +
        `/stages/${encodeURIComponent(envelope.requestId)}/tool-call-results`;

      await _post(url, {
        results: [{ content, id: envelope.toolCallId }],
      });
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
      lastError?: {
        at: string;
        code: 'budget_burnout' | 'stage_failed';
        message: string;
        requestId?: string;
        stageId?: string;
        stageIndex?: number;
      };
      liveViewVncPort?: number | null;
      result?: unknown;
      runCursor?: {
        kind: 'pipeline' | 'repair';
        loopMeta?: unknown;
        repairInstruction?: string;
        stageIndex: number;
      } | undefined;
    },
  ) => {
    enqueue(async () => {
      if (!baseUrl) return;

      const url = `${baseUrl}/api/sessions/${encodeURIComponent(sessionId)}`;

      await _patch(url, {
        ...('result' in body ? { result: body.result } : {}),
        ...('liveViewVncPort' in body ? { liveViewVncPort: body.liveViewVncPort } : {}),
        ...('runCursor' in body ? { runCursor: body.runCursor } : {}),
        ...('lastError' in body ? { lastError: body.lastError } : {}),
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
    appendToolResult,
    createStage,
    flush,
    patchLiveViewVncPort,
    patchSession,
    patchStage,
    registerSession,
  };
};
