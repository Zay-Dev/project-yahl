const PLACEHOLDER_KEYS = new Set(["", "placeholder", "sk-no-auth-required"]);

export const hasRealApiKey = (apiKey: string) => {
  const trimmed = apiKey.trim().toLowerCase();

  return trimmed.length > 0 && !PLACEHOLDER_KEYS.has(trimmed);
};

export const effectiveApiKey = (apiKey: string) =>
  hasRealApiKey(apiKey) ? apiKey.trim() : "placeholder";

export const normalizeStagehandModel = (raw: string) => {
  const trimmed = raw.trim();

  if (!trimmed) return "openai/gpt-4o-mini";

  if (trimmed.includes("/")) return trimmed;

  return `openai/${trimmed}`;
};

export const openAiFetch = (apiKey: string): typeof fetch | undefined => {
  if (hasRealApiKey(apiKey)) return undefined;

  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers || {});
    headers.delete("authorization");

    return fetch(input, {
      ...init,
      headers,
    });
  };
};
