export const LLM_CALL_RETRY_SLEEP_MS = 60_000;

export const LLM_TRANSPORT_RETRY_SLEEP_MS = 10_000;

export const LLM_CALL_RETRY_SLEEP_GROWTH = 1.1;

export class LlmHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly bodyText: string,
  ) {
    super(message);
    this.name = 'LlmHttpError';
  }
}

const collectErrorText = (error: unknown) => {
  const parts: string[] = [];
  let current: unknown = error;

  for (let depth = 0; depth < 6 && current; depth += 1) {
    if (current instanceof Error) {
      parts.push(current.message);
      current = current.cause;
      continue;
    }

    parts.push(String(current));
    break;
  }

  return parts.join(' | ');
};

export const isRetryableLlmTransportError = (error: unknown) => {
  const text = collectErrorText(error);
  const name = error instanceof Error ? error.name : '';
  const code = error && typeof error === 'object' && 'code' in error
    ? String((error as { code?: unknown }).code ?? '')
    : '';

  return /UND_ERR_|ECONNRESET|ETIMEDOUT|ECONNREFUSED|fetch failed|other side closed|socket hang up|Request timed out|timed out|TimeoutError|UND_ERR_HEADERS_TIMEOUT/i
    .test(`${name} ${code} ${text}`);
};

export const isRetryableLlmCallError = (error: unknown) => {
  if (error instanceof LlmHttpError) {
    return error.status >= 400;
  }

  if (isRetryableLlmTransportError(error)) {
    return true;
  }

  return false;
};

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

export const resolveRetrySleepMs = (
  error: unknown,
  httpSleepMs: number,
) => {
  if (error instanceof LlmHttpError) {
    return httpSleepMs;
  }

  if (isRetryableLlmTransportError(error)) {
    return LLM_TRANSPORT_RETRY_SLEEP_MS;
  }

  return httpSleepMs;
};

export const withLlmCallRetry = async <T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts: number;
    sleep?: (ms: number) => Promise<void>;
    sleepMs?: number;
  },
): Promise<T> => {
  const maxAttempts = Math.max(1, options.maxAttempts);
  let httpSleepMs = options.sleepMs ?? LLM_CALL_RETRY_SLEEP_MS;
  const sleep = options.sleep ?? defaultSleep;

  let attempt = 0;
  let lastError: unknown;

  while (attempt < maxAttempts) {
    attempt += 1;

    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (!isRetryableLlmCallError(error) || attempt >= maxAttempts) {
        throw error;
      }

      const message = error instanceof Error ? error.message : String(error);
      const status = error instanceof LlmHttpError ? error.status : undefined;
      const retrySleepMs = resolveRetrySleepMs(error, httpSleepMs);
      const cause = isRetryableLlmTransportError(error) ? 'transport' : 'http';

      console.warn(
        `[llm-proxy] retryable ${cause} error; retry attempt=${attempt + 1}/${maxAttempts} `
          + `sleepMs=${retrySleepMs}${status == null ? '' : ` status=${status}`} message=${message}`,
      );

      await sleep(retrySleepMs);
      httpSleepMs = Math.floor(httpSleepMs * LLM_CALL_RETRY_SLEEP_GROWTH);
    }
  }

  throw lastError;
};
