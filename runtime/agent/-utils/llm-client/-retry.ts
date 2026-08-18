export const LLM_CALL_RETRY_SLEEP_MS = 60_000;

export const LLM_TRANSPORT_RETRY_SLEEP_MS = 10_000;

export const LLM_CALL_RETRY_SLEEP_GROWTH = 1.1;

export const resolveLlmCallRetryMax = () => {
  const raw = Math.floor(Number(process.env.LLM_CALL_RETRY_MAX ?? 3));

  return Number.isFinite(raw) && raw > 0 ? raw : 3;
};

const coerceHttpStatus = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim());

    if (Number.isFinite(parsed)) return parsed;
  }

  return undefined;
};

const parseHttpStatusFromMessage = (message: string): number | undefined => {
  const angle = message.match(/<(\d{3})>/);
  if (angle) {
    return Number(angle[1]);
  }

  const leading = message.match(/^(\d{3})\b/);
  if (leading) {
    return Number(leading[1]);
  }

  return undefined;
};

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

export const resolveLlmHttpStatus = (error: unknown): number | undefined => {
  if (!error || typeof error !== "object") return undefined;

  const record = error as Record<string, unknown>;
  const fromField = coerceHttpStatus(record.status ?? record.statusCode);

  if (fromField !== undefined) return fromField;

  const message = error instanceof Error ? error.message : String(error);

  return parseHttpStatusFromMessage(message);
};

export const isRetryableLlmHttpError = (error: unknown) => {
  if (isRetryableLlmTransportError(error)) {
    return true;
  }

  const status = resolveLlmHttpStatus(error);

  if (status === undefined) return false;

  return status >= 400;
};

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

export const resolveRetrySleepMs = (
  error: unknown,
  httpSleepMs: number,
) => {
  if (isRetryableLlmTransportError(error) && resolveLlmHttpStatus(error) === undefined) {
    return LLM_TRANSPORT_RETRY_SLEEP_MS;
  }

  return httpSleepMs;
};

export const withLlmCallRetry = async <T>(
  fn: () => Promise<T>,
  options?: {
    maxAttempts?: number;
    sleep?: (ms: number) => Promise<void>;
    sleepMs?: number;
  },
): Promise<T> => {
  const maxAttempts = options?.maxAttempts ?? resolveLlmCallRetryMax();
  let httpSleepMs = options?.sleepMs ?? LLM_CALL_RETRY_SLEEP_MS;
  const sleep = options?.sleep ?? defaultSleep;

  let attempt = 0;
  let lastError: unknown;

  while (attempt < maxAttempts) {
    attempt += 1;

    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (!isRetryableLlmHttpError(error) || attempt >= maxAttempts) {
        throw error;
      }

      const status = resolveLlmHttpStatus(error);
      const message = error instanceof Error ? error.message : String(error);
      const retrySleepMs = resolveRetrySleepMs(error, httpSleepMs);
      const cause = isRetryableLlmTransportError(error) ? 'transport' : 'http';

      console.warn(
        `[llm] retryable ${cause} error; retry attempt=${attempt + 1}/${maxAttempts} `
          + `sleepMs=${retrySleepMs}${status == null ? '' : ` status=${status}`} message=${message}`,
      );

      await sleep(retrySleepMs);
      httpSleepMs = Math.floor(httpSleepMs * LLM_CALL_RETRY_SLEEP_GROWTH);
    }
  }

  throw lastError;
};
