import { getLlmRequestContext } from "./llm-request-context";

const PLACEHOLDER_KEYS = new Set(["", "placeholder", "sk-no-auth-required"]);

export const hasRealApiKey = (apiKey: string) => {
  const trimmed = apiKey.trim().toLowerCase();

  return trimmed.length > 0 && !PLACEHOLDER_KEYS.has(trimmed);
};

export const effectiveApiKey = (_apiKey?: string) => "placeholder";

export const normalizeStagehandModel = (raw: string) => {
  const trimmed = raw.trim();

  if (!trimmed) return "openai/gpt-4o-mini";

  if (trimmed.includes("/")) return trimmed;

  return `openai/${trimmed}`;
};

export const normalizeLlmBaseUrl = (value: string) =>
  value
    .replace(/\/+$/, "")
    .replace(/\/v1\/chat\/completions$/, "")
    .replace(/\/chat\/completions$/, "");

export const normalizeProviderDomain = (raw: string) => {
  const trimmed = raw.trim();

  if (!trimmed) return "";

  try {
    const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

    return new URL(withScheme).host;
  } catch {
    return trimmed
      .replace(/^https?:\/\//i, "")
      .split("/")[0]
      ?.split("?")[0]
      ?.trim()
      ?? "";
  }
};

export const resolveLlmProxyToken = () => process.env.LLM_PROXY_TOKEN?.trim() ?? "";

export const openAiFetch = (
  options?: { providerDomain: string },
): typeof fetch => {
  const providerDomain = options?.providerDomain.trim() || "";

  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers || {});

    headers.delete("authorization");

    const proxyToken = resolveLlmProxyToken();

    if (proxyToken) {
      headers.set("x-llm-proxy-token", proxyToken);
    }

    if (providerDomain) {
      headers.set("x-domain", providerDomain);
    }

    const ctx = getLlmRequestContext();

    if (ctx?.sessionId) {
      headers.set("x-session-id", ctx.sessionId);
    }

    if (ctx?.requestId) {
      headers.set("x-request-id", ctx.requestId);
    }

    if (ctx?.format) {
      headers.set("x-format", ctx.format);
    }

    if (ctx?.tags?.length) {
      headers.set("x-tags", ctx.tags.join(","));
    }

    if (ctx?.retryMax !== undefined && ctx.retryMax >= 0) {
      headers.set("x-llm-retry-max", String(ctx.retryMax));
    }

    return fetch(input, {
      ...init,
      headers,
    });
  };
};
