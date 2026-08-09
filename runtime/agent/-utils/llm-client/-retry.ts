export const LLM_CALL_RETRY_SLEEP_MS = 60_000;

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

export const resolveLlmHttpStatus = (error: unknown): number | undefined => {
  if (!error || typeof error !== "object") return undefined;

  const record = error as Record<string, unknown>;
  const fromField = coerceHttpStatus(record.status ?? record.statusCode);

  if (fromField !== undefined) return fromField;

  const message = error instanceof Error ? error.message : String(error);

  return parseHttpStatusFromMessage(message);
};

export const isRetryableLlmHttpError = (error: unknown) => {
  const status = resolveLlmHttpStatus(error);

  if (status === undefined) return false;

  return status >= 400;
};

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

export const withLlmCallRetry = async <T>(
  fn: () => Promise<T>,
  options?: {
    maxAttempts?: number;
    sleep?: (ms: number) => Promise<void>;
    sleepMs?: number;
  },
): Promise<T> => {
  const maxAttempts = options?.maxAttempts ?? resolveLlmCallRetryMax();
  let sleepMs = options?.sleepMs ?? LLM_CALL_RETRY_SLEEP_MS;
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

      console.warn(
        `[llm] retryable HTTP error; retry attempt=${attempt + 1}/${maxAttempts} `
          + `sleepMs=${sleepMs} status=${status} message=${message}`,
      );

      await sleep(sleepMs);
      sleepMs = Math.floor(sleepMs * LLM_CALL_RETRY_SLEEP_GROWTH);
    }
  }

  throw lastError;
};
