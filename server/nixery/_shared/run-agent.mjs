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

export const callChat = async (params) => {
  const base = params.baseUrl.replace(/\/+$/, '');
  const url = `${base}/chat/completions`;
  const headers = {
    'Content-Type': 'application/json',
  };

  if (hasRealApiKey(params.apiKey)) {
    headers.Authorization = `Bearer ${params.apiKey}`;
  }

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
    throw new Error(`openai chat failed: ${response.status} ${body.slice(0, 500)}`);
  }

  return response.json();
};
