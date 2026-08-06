export const LLM_CALL_RETRY_SLEEP_MS = 60_000;

export const resolveLlmCallRetryMax = () => {
  const raw = Math.floor(Number(process.env.LLM_CALL_RETRY_MAX ?? 3));

  return Number.isFinite(raw) && raw > 0 ? raw : 3;
};

export const isRetryableLlmHttpError = (error) => {
  if (!error || typeof error !== 'object') return false;

  const status = error.status ?? error.statusCode;

  if (typeof status !== 'number' || !Number.isFinite(status)) return false;

  return status === 408 || status === 429 || status >= 500;
};

const defaultSleep = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export const withLlmCallRetry = async (fn, options = {}) => {
  const maxAttempts = options.maxAttempts ?? resolveLlmCallRetryMax();
  const sleepMs = options.sleepMs ?? LLM_CALL_RETRY_SLEEP_MS;
  const sleep = options.sleep ?? defaultSleep;

  let attempt = 0;
  let lastError;

  while (attempt < maxAttempts) {
    attempt += 1;

    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (!isRetryableLlmHttpError(error) || attempt >= maxAttempts) {
        throw error;
      }

      const status = error.status ?? error.statusCode;
      const message = error instanceof Error ? error.message : String(error);

      console.warn(
        `[nixery] retryable HTTP error; retry attempt=${attempt + 1}/${maxAttempts} `
          + `sleepMs=${sleepMs} status=${status} message=${message}`,
      );

      await sleep(sleepMs);
    }
  }

  throw lastError;
};
