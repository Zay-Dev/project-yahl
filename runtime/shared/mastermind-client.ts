import { randomUUID } from 'node:crypto';

import type { TRequestStatusResponse } from '@project-yahl/shared/request-activity/types';

import {
  ActivityRequestFailedError,
  DEFAULT_ACTIVITY_DEADLINE_MS,
  fetchRequestStatus,
  formatActivityFetchError,
  postWithActivityRecovery,
} from '@project-yahl/shared/request-activity/client';

const mastermindBaseUrl = () =>
  (process.env.MASTERMIND_API_URL?.trim() || 'http://mastermind:4100').replace(/\/+$/, '');

const activityOptions = () => ({
  deadlineMs: DEFAULT_ACTIVITY_DEADLINE_MS,
  errorPrefix: 'mastermind' as const,
  onPollError: (error: unknown) => {
    const message = error instanceof Error ? error.message : 'request-status poll failed';

    console.log(`[mastermind-client] request-status poll error=${message}`);
  },
});

export type TMastermindSkillResponse = {
  data?: unknown;
  error?: string;
  invocationId?: string;
  ok: boolean;
  queueDepth?: number;
  requestStatus?: 'failed' | 'queued' | 'running' | 'succeeded';
  retryable?: boolean;
  unavailable?: boolean;
};

export type TKnowledgePersistedIndexItem = {
  absolutePath: string;
  key: string;
  relativePath: string;
};

export type TVerifyStageSnapshot = {
  askUser?: Record<string, unknown>[];
  contextKeys?: string[];
  logic?: string;
  produceContextKeys?: string[];
};

export type TMastermindRequestStatusResponse = TRequestStatusResponse;

const mastermindFetch = (url: string, init?: RequestInit): Promise<Response> => {
  if (init?.signal) {
    return fetch(url, init);
  }

  return fetch(url, {
    ...init,
    signal: AbortSignal.timeout(DEFAULT_ACTIVITY_DEADLINE_MS),
  });
};

export const fetchMastermindRequestStatus = async (params: {
  invocationId?: string;
  requestId: string;
  sessionId: string;
}): Promise<TMastermindRequestStatusResponse> =>
  fetchRequestStatus(mastermindBaseUrl(), params);

const resolveActivityWatch = (sessionId?: string, requestId?: string) => {
  const trimmedSessionId = sessionId?.trim();
  const trimmedRequestId = requestId?.trim();

  if (!trimmedSessionId || !trimmedRequestId) {
    return null;
  }

  return {
    invocationId: randomUUID(),
    requestId: trimmedRequestId,
    sessionId: trimmedSessionId,
  };
};

const buildSkillFailure = (
  message: string,
  watch: ReturnType<typeof resolveActivityWatch>,
  lastStatus: TMastermindRequestStatusResponse['request'] | null,
  queueDepth?: number,
): TMastermindSkillResponse => {
  const retryable = message.startsWith('mastermind_request_still_running:');

  return {
    error: message,
    ...(watch ? { invocationId: watch.invocationId } : {}),
    ok: false,
    ...(queueDepth === undefined ? {} : { queueDepth }),
    ...(lastStatus?.status ? { requestStatus: lastStatus.status } : {}),
    ...(retryable ? { retryable: true } : {}),
    ...(message.includes('unavailable') || lastStatus?.unavailable ? { unavailable: true } : {}),
  };
};

export const callMastermindSkill = async (
  name: string,
  args: Record<string, unknown>,
  sessionId?: string,
  requestId?: string,
): Promise<TMastermindSkillResponse> => {
  const baseUrl = mastermindBaseUrl();
  const url = `${baseUrl}/v1/skills/${encodeURIComponent(name)}`;
  const startedAt = Date.now();
  const watch = resolveActivityWatch(sessionId, requestId);
  const options = activityOptions();

  console.log(
    `[mastermind-client] POST ${name} url=${baseUrl} sessionId=${sessionId ?? '-'} requestId=${requestId ?? '-'} invocationId=${watch?.invocationId ?? '-'}`,
  );

  try {
    const { lastStatus, queueDepth, recovered, response: res } = await postWithActivityRecovery(
      baseUrl,
      url,
      {
        args,
        caller: 'stage-agent',
        ...(watch ? { invocationId: watch.invocationId } : {}),
        ...(requestId ? { requestId } : {}),
        sessionId,
      },
      watch,
      options,
    );

    const body = await res.json() as TMastermindSkillResponse;
    const durationMs = Date.now() - startedAt;

    console.log(
      `[mastermind-client] ${name} http=${res.status} ok=${body.ok} recovered=${recovered} durationMs=${durationMs}`,
    );

    if (!res.ok) {
      return buildSkillFailure(
        body.error ?? `mastermind ${name}: HTTP ${res.status}`,
        watch,
        lastStatus,
        queueDepth,
      );
    }

    return body;
  } catch (error) {
    const durationMs = Date.now() - startedAt;

    if (error instanceof ActivityRequestFailedError) {
      console.log(`[mastermind-client] ${name} failed durationMs=${durationMs} error=${error.message}`);

      return buildSkillFailure(error.message, watch, null, undefined);
    }

    const message = error instanceof Error
      ? error.message
      : formatActivityFetchError(error, null, 'mastermind');

    console.log(`[mastermind-client] ${name} failed durationMs=${durationMs} error=${message}`);

    return buildSkillFailure(message, watch, null);
  }
};

export const fetchMastermindPersistedIndex = async (
  topic: string,
): Promise<TKnowledgePersistedIndexItem[]> => {
  const url = `${mastermindBaseUrl()}/v1/knowledges/${encodeURIComponent(topic)}/persisted-index`;

  try {
    const res = await mastermindFetch(url, { method: 'GET' });

    if (!res.ok) {
      console.log(`[mastermind-client] persisted-index http=${res.status} topic=${topic}`);
      return [];
    }

    const body = await res.json() as { ok?: boolean; persisted?: TKnowledgePersistedIndexItem[] };

    return Array.isArray(body.persisted) ? body.persisted : [];
  } catch (error) {
    const message = error instanceof Error ? error.message : 'mastermind persisted-index failed';

    console.log(`[mastermind-client] persisted-index failed topic=${topic} error=${message}`);

    return [];
  }
};

export { ActivityRequestFailedError as MastermindRequestFailedError };
