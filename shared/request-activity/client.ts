import type {
  TActivityErrorPrefix,
  TActivityWatch,
  TRequestActivityRecord,
  TRequestStatusResponse,
} from './types.js';

export const DEFAULT_ACTIVITY_DEADLINE_MS = 90 * 60 * 1000;
export const DEFAULT_ACTIVITY_POLL_MS = 5_000;
export const DEFAULT_ACTIVITY_POLL_FETCH_TIMEOUT_MS = 3_000;

export class ActivityRequestFailedError extends Error {
  readonly unavailable: boolean;

  constructor(message: string, unavailable = true) {
    super(message);
    this.name = 'ActivityRequestFailedError';
    this.unavailable = unavailable;
  }
}

export type TActivityClientOptions = {
  deadlineMs?: number;
  errorPrefix: TActivityErrorPrefix;
  onPollError?: (error: unknown) => void;
  pollFetchTimeoutMs?: number;
  pollMs?: number;
};

const resolveOptions = (options: TActivityClientOptions) => ({
  deadlineMs: options.deadlineMs ?? DEFAULT_ACTIVITY_DEADLINE_MS,
  errorPrefix: options.errorPrefix,
  onPollError: options.onPollError,
  pollFetchTimeoutMs: options.pollFetchTimeoutMs ?? DEFAULT_ACTIVITY_POLL_FETCH_TIMEOUT_MS,
  pollMs: options.pollMs ?? DEFAULT_ACTIVITY_POLL_MS,
});

const fetchShort = (url: string, timeoutMs: number, init?: RequestInit): Promise<Response> =>
  fetch(url, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
  });

export const fetchRequestStatus = async (
  baseUrl: string,
  params: {
    invocationId?: string;
    requestId: string;
    sessionId: string;
  },
  pollFetchTimeoutMs = DEFAULT_ACTIVITY_POLL_FETCH_TIMEOUT_MS,
): Promise<TRequestStatusResponse> => {
  const url = new URL(`${baseUrl.replace(/\/+$/, '')}/v1/request-status`);

  url.searchParams.set('sessionId', params.sessionId);
  url.searchParams.set('requestId', params.requestId);

  if (params.invocationId) {
    url.searchParams.set('invocationId', params.invocationId);
  }

  const res = await fetchShort(url.toString(), pollFetchTimeoutMs, { method: 'GET' });

  if (!res.ok) {
    return {
      ok: true,
      request: null,
    };
  }

  return await res.json() as TRequestStatusResponse;
};

export const formatActivityFetchError = (
  error: unknown,
  lastStatus: TRequestActivityRecord | null,
  errorPrefix: TActivityErrorPrefix,
): string => {
  if (error instanceof ActivityRequestFailedError) {
    return error.message;
  }

  const message = error instanceof Error ? error.message : `${errorPrefix} request failed`;

  if (lastStatus?.status === 'queued' || lastStatus?.status === 'running') {
    return `${errorPrefix}_request_still_running: ${message}`;
  }

  if (
    message.includes('ECONNREFUSED')
    || message.includes('ENOTFOUND')
    || message.includes('EHOSTUNREACH')
    || message.includes('network')
  ) {
    return `${errorPrefix}_unreachable: ${message}`;
  }

  if (message.includes('timeout') || message.includes('aborted')) {
    return `${errorPrefix}_request_timeout: ${message}`;
  }

  if (message === 'fetch failed') {
    return `${errorPrefix}_unreachable: fetch failed`;
  }

  return message;
};

const isStillRunningError = (message: string, errorPrefix: TActivityErrorPrefix) =>
  message.startsWith(`${errorPrefix}_request_still_running:`);

const sleep = (ms: number) => new Promise<void>((resolve) => {
  setTimeout(resolve, ms);
});

export const waitForTerminalActivity = async (
  baseUrl: string,
  watch: TActivityWatch,
  deadlineAt: number,
  options: TActivityClientOptions,
): Promise<TRequestStatusResponse> => {
  const resolved = resolveOptions(options);

  while (Date.now() < deadlineAt) {
    const remainingMs = deadlineAt - Date.now();

    if (remainingMs <= 0) {
      break;
    }

    try {
      const status = await fetchRequestStatus(
        baseUrl,
        watch,
        resolved.pollFetchTimeoutMs,
      );
      const record = status.request ?? null;

      if (record?.invocationId && record.invocationId !== watch.invocationId) {
        await sleep(Math.min(resolved.pollMs, remainingMs));
        continue;
      }

      if (record?.status === 'succeeded' || record?.status === 'failed') {
        return status;
      }
    } catch (error) {
      resolved.onPollError?.(error);
    }

    await sleep(Math.min(resolved.pollMs, Math.max(deadlineAt - Date.now(), 0)));
  }

  throw new Error(`${resolved.errorPrefix}_request_timeout: activity wait deadline exceeded`);
};

export const fetchWithActivityWatch = async (
  baseUrl: string,
  postUrl: string,
  init: RequestInit,
  watch: TActivityWatch,
  options: TActivityClientOptions,
): Promise<Response> => {
  const resolved = resolveOptions(options);
  const controller = new AbortController();
  const parentSignal = init.signal;

  if (parentSignal?.aborted) {
    controller.abort();
  } else if (parentSignal) {
    parentSignal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  const timeoutId = setTimeout(() => controller.abort(), resolved.deadlineMs);

  let pollTimer: ReturnType<typeof setInterval> | undefined;
  let failedMessage: string | null = null;
  let failedUnavailable = true;
  let lastPolledStatus: TRequestActivityRecord | null = null;

  const pollOnce = () => {
    void fetchRequestStatus(
      baseUrl,
      watch,
      resolved.pollFetchTimeoutMs,
    )
      .then((status) => {
        lastPolledStatus = status.request ?? null;

        if (status.request?.status !== 'failed') {
          return;
        }

        if (
          status.request.invocationId
          && status.request.invocationId !== watch.invocationId
        ) {
          return;
        }

        failedMessage = status.request.error ?? status.error ?? `${resolved.errorPrefix} request failed`;
        failedUnavailable = status.request.unavailable ?? status.unavailable ?? true;
        controller.abort();
      })
      .catch((error) => {
        resolved.onPollError?.(error);
      });
  };

  pollOnce();
  pollTimer = setInterval(pollOnce, resolved.pollMs);

  try {
    return await fetch(postUrl, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (failedMessage) {
      throw new ActivityRequestFailedError(failedMessage, failedUnavailable);
    }

    throw new Error(formatActivityFetchError(error, lastPolledStatus, resolved.errorPrefix));
  } finally {
    clearTimeout(timeoutId);

    if (pollTimer) {
      clearInterval(pollTimer);
    }
  }
};

export const postWithActivityWatch = async (
  baseUrl: string,
  postUrl: string,
  body: unknown,
  watch: TActivityWatch | null,
  options: TActivityClientOptions,
): Promise<Response> => {
  const init: RequestInit = {
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  };

  if (!watch) {
    return fetch(postUrl, {
      ...init,
      signal: AbortSignal.timeout(options.deadlineMs ?? DEFAULT_ACTIVITY_DEADLINE_MS),
    });
  }

  return fetchWithActivityWatch(baseUrl, postUrl, init, watch, options);
};

export type TActivityPostResult = {
  lastStatus: TRequestActivityRecord | null;
  queueDepth?: number;
  recovered: boolean;
  response: Response;
};

export const postWithActivityRecovery = async (
  baseUrl: string,
  postUrl: string,
  body: unknown,
  watch: TActivityWatch | null,
  options: TActivityClientOptions,
): Promise<TActivityPostResult> => {
  const resolved = resolveOptions(options);
  const startedAt = Date.now();
  const deadlineAt = startedAt + resolved.deadlineMs;

  if (!watch) {
    const response = await postWithActivityWatch(baseUrl, postUrl, body, null, options);

    return {
      lastStatus: null,
      recovered: false,
      response,
    };
  }

  try {
    const response = await postWithActivityWatch(baseUrl, postUrl, body, watch, options);

    return {
      lastStatus: null,
      recovered: false,
      response,
    };
  } catch (error) {
    if (error instanceof ActivityRequestFailedError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : `${resolved.errorPrefix} request failed`;

    const shouldWait = isStillRunningError(message, resolved.errorPrefix)
      || (watch && message.includes(`${resolved.errorPrefix}_unreachable:`));

    if (!shouldWait || !watch) {
      throw error;
    }

    if (!isStillRunningError(message, resolved.errorPrefix)) {
      try {
        const status = await fetchRequestStatus(
          baseUrl,
          watch,
          resolved.pollFetchTimeoutMs,
        );
        const record = status.request ?? null;
        const recordStatus = record?.status;

        if (recordStatus === 'failed') {
          throw new ActivityRequestFailedError(
            record?.error ?? status.error ?? `${resolved.errorPrefix} request failed`,
            record?.unavailable ?? status.unavailable ?? true,
          );
        }

        if (recordStatus !== 'queued' && recordStatus !== 'running') {
          throw error;
        }
      } catch (statusError) {
        if (statusError instanceof ActivityRequestFailedError) {
          throw statusError;
        }

        if (statusError === error) {
          throw error;
        }

        resolved.onPollError?.(statusError);
        throw error;
      }
    }

    const terminal = await waitForTerminalActivity(baseUrl, watch, deadlineAt, options);
    const record = terminal.request ?? null;

    if (record?.status === 'failed') {
      throw new ActivityRequestFailedError(
        record.error ?? terminal.error ?? `${resolved.errorPrefix} request failed`,
        record.unavailable ?? terminal.unavailable ?? true,
      );
    }

    if (record?.status === 'succeeded') {
      return {
        lastStatus: record,
        queueDepth: terminal.queueDepth,
        recovered: true,
        response: new Response(JSON.stringify({
          data: record.resultData ?? '',
          ok: true,
        }), {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        }),
      };
    }

    throw new Error(`${resolved.errorPrefix}_request_timeout: activity recovery deadline exceeded`);
  }
};

export const isActivityStillRunningMessage = (
  message: string,
  errorPrefix: TActivityErrorPrefix,
) => isStillRunningError(message, errorPrefix);
