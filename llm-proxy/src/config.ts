import 'dotenv/config';

export const resolveDefaultRetryMax = () => {
  const raw = Math.floor(Number(process.env.LLM_CALL_RETRY_MAX ?? 3));

  return Number.isFinite(raw) && raw > 0 ? raw : 3;
};

export const config = {
  port: Math.max(1, Math.floor(Number(process.env.LLM_PROXY_PORT ?? 4100)) || 4100),
  proxyToken: process.env.LLM_PROXY_TOKEN?.trim() ?? '',
  sessionApiBaseUrl: (process.env.SESSION_API_BASE_URL || 'http://server:4000').replace(/\/+$/, ''),
};
