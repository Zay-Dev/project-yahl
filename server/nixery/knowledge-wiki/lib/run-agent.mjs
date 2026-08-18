export const resolveDefId = (defRoot) =>
  process.env.NIXERY_DEF_ID?.trim() || defRoot.split('/').filter(Boolean).pop() || 'nixery';

export const logProgress = (defId, message) => {
  console.error(`[nixery-${defId}] ${message}`);
};

export const callChatWithLog = async (defId, round, fetchFn) => {
  const started = Date.now();

  logProgress(defId, `llm round=${round} start`);

  const result = await fetchFn();

  logProgress(defId, `llm round=${round} done ms=${Date.now() - started}`);

  return result;
};

const PLACEHOLDER_KEYS = new Set(['', 'placeholder', 'sk-no-auth-required']);

export const hasRealApiKey = (apiKey) => {
  const trimmed = apiKey.trim().toLowerCase();

  return trimmed.length > 0 && !PLACEHOLDER_KEYS.has(trimmed);
};

export const normalizeProviderDomain = (raw) => {
  const trimmed = typeof raw === 'string' ? raw.trim() : '';

  if (!trimmed) return '';

  try {
    const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

    return new URL(withScheme).host;
  } catch {
    return trimmed.replace(/^https?:\/\//i, '').split('/')[0]?.split('?')[0]?.trim() ?? '';
  }
};

export const resolveProviderDomain = (explicit) => {
  const fromExplicit = normalizeProviderDomain(explicit || '');
  if (fromExplicit) return fromExplicit;

  return normalizeProviderDomain(process.env.OPENAI_PROVIDER_DOMAIN || '');
};

export const resolveLlmProxyToken = () => {
  const token = process.env.LLM_PROXY_TOKEN?.trim() ?? '';

  if (!token) {
    throw new Error('LLM_PROXY_TOKEN is required for llm-proxy calls');
  }

  return token;
};

export const buildLlmHeaders = (params) => {
  const headers = {
    'Content-Type': 'application/json',
    'X-Llm-Proxy-Token': resolveLlmProxyToken(),
  };

  const domain = resolveProviderDomain(params.domain);

  if (!domain) {
    throw new Error('OPENAI_PROVIDER_DOMAIN (or params.domain) is required for llm-proxy calls');
  }

  headers['x-domain'] = domain;

  const sessionId = process.env.YAHL_SESSION_ID?.trim();
  const requestId = process.env.YAHL_REQUEST_ID?.trim();

  if (sessionId) headers['x-session-id'] = sessionId;
  if (requestId) headers['x-request-id'] = requestId;

  const defId = process.env.NIXERY_DEF_ID?.trim();

  if (defId) {
    headers['x-tags'] = `nixery:${defId}`;
  }

  const retryRaw = process.env.LLM_CALL_RETRY_MAX?.trim();

  if (retryRaw) {
    const parsed = Math.floor(Number(retryRaw));

    if (Number.isFinite(parsed) && parsed >= 0) {
      headers['x-llm-retry-max'] = String(parsed);
    }
  }

  const format = process.env.OPENAI_FORMAT?.trim() || process.env.LLM_FORMAT?.trim();

  if (format) {
    headers['x-format'] = format;
  }

  return headers;
};

export const callChat = async (params) => {
  const base = params.baseUrl.replace(/\/+$/, '');
  const url = `${base}/chat/completions`;
  const headers = buildLlmHeaders(params);

  const response = await fetch(url, {
    body: JSON.stringify({
      max_tokens: params.maxTokens,
      messages: params.messages,
      model: params.model,
      temperature: params.temperature ?? 0.2,
      tools: params.tools,
    }),
    headers,
    method: 'POST',
  });

  if (!response.ok) {
    const body = await response.text();
    const error = new Error(`openai chat failed: ${response.status} ${body.slice(0, 500)}`);
    error.status = response.status;
    throw error;
  }

  return response.json();
};
