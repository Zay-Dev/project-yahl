import { anthropicResponseToOpenAi, openAiBodyToAnthropic } from './anthropic-translate.js';
import { config, resolveDefaultRetryMax } from './config.js';
import { readOneCliCaPem } from './load-onecli-env.js';
import { resolveHttpsProxyUrl } from './onecli-transport.js';
import { postModelResponse } from './postback.js';
import {
  isValidLlmProxyToken,
  parseTagsHeader,
  resolveDomainFromRequest,
  resolveFormat,
  resolveRetryMaxFromHeader,
} from './request-meta.js';
import { LlmHttpError, withLlmCallRetry } from './retry.js';
import { deriveModelResponseTags, mergeTags } from './tags.js';
import { isQuotaExhausted } from './quota-state.js';

const readJsonBody = async (req: Request): Promise<Record<string, unknown>> => {
  const raw = await req.text();

  if (!raw.trim()) return {};

  return JSON.parse(raw) as Record<string, unknown>;
};

const resolveThinkingMode = (body: Record<string, unknown>): boolean => {
  const thinking = body.thinking;

  if (!thinking || typeof thinking !== 'object' || Array.isArray(thinking)) {
    return false;
  }

  return (thinking as { type?: unknown }).type === 'enabled';
};

const upstreamPathForFormat = (
  requestPath: string,
  format: 'openai' | 'anthropic',
): string => {
  if (format === 'anthropic') {
    if (requestPath.endsWith('/chat/completions') || requestPath.endsWith('/v1/chat/completions')) {
      return '/v1/messages';
    }

    return requestPath.includes('/v1/') ? requestPath : `/v1${requestPath}`;
  }

  if (requestPath === '/chat/completions') return '/v1/chat/completions';
  if (requestPath === '/v1/chat/completions') return '/v1/chat/completions';

  return requestPath.startsWith('/') ? requestPath : `/${requestPath}`;
};

const buildUpstreamHeaders = (format: 'openai' | 'anthropic'): Headers => {
  const headers = new Headers();
  headers.set('content-type', 'application/json');

  if (format === 'anthropic') {
    headers.set('anthropic-version', '2023-06-01');
  }

  return headers;
};

const formatErrorCause = (error: unknown) => {
  const parts: string[] = [];
  let current: unknown = error;

  for (let i = 0; i < 6 && current; i += 1) {
    if (current instanceof Error) {
      const code = 'code' in current ? String((current as { code?: unknown }).code ?? '') : '';

      parts.push([code, current.message].filter(Boolean).join(' '));
      current = current.cause;
      continue;
    }

    parts.push(String(current));
    break;
  }

  return parts.join(' | ');
};

const fetchUpstream = async (
  url: string,
  init: { body: string; headers: Headers },
): Promise<Response> => {
  const proxyUrl = resolveHttpsProxyUrl();

  if (!proxyUrl) {
    return fetch(url, {
      body: init.body,
      headers: init.headers,
      method: 'POST',
    });
  }

  const { ProxyAgent, fetch: undiciFetch } = await import('undici');
  const ca = readOneCliCaPem();
  const dispatcher = new ProxyAgent({
    ...(ca ? { requestTls: { ca } } : {}),
    uri: proxyUrl,
  });
  const headerInit: Record<string, string> = {};

  init.headers.forEach((value, key) => {
    headerInit[key] = value;
  });

  return undiciFetch(url, {
    body: init.body,
    dispatcher,
    headers: headerInit,
    method: 'POST',
  }) as unknown as Response;
};

const callUpstream = async (params: {
  body: Record<string, unknown>;
  domain: string;
  format: 'openai' | 'anthropic';
  requestPath: string;
}): Promise<Record<string, unknown>> => {
  const upstreamPath = upstreamPathForFormat(params.requestPath, params.format);
  const url = `https://${params.domain}${upstreamPath}`;
  const headers = buildUpstreamHeaders(params.format);
  const payload = params.format === 'anthropic'
    ? openAiBodyToAnthropic(params.body)
    : params.body;

  const response = await fetchUpstream(url, {
    body: JSON.stringify(payload),
    headers,
  });

  const bodyText = await response.text();

  if (!response.ok) {
    throw new LlmHttpError(
      `upstream ${response.status}: ${bodyText.slice(0, 500)}`,
      response.status,
      bodyText,
    );
  }

  let parsed: Record<string, unknown>;

  try {
    parsed = JSON.parse(bodyText) as Record<string, unknown>;
  } catch {
    throw new LlmHttpError(
      `upstream returned non-JSON: ${bodyText.slice(0, 200)}`,
      502,
      bodyText,
    );
  }

  if (params.format === 'anthropic') {
    return anthropicResponseToOpenAi(parsed, params.body.model);
  }

  return parsed;
};

export const handleChatCompletions = async (req: Request): Promise<Response> => {
  const url = new URL(req.url);

  try {
    if (!isValidLlmProxyToken(req.headers, config.proxyToken)) {
      return Response.json(
        { error: { message: 'invalid llm proxy token', type: 'unauthorized' } },
        { status: 401 },
      );
    }

    if (isQuotaExhausted()) {
      return Response.json(
        { error: { message: 'token quota exhausted', type: 'quota_exhausted' } },
        { status: 429 },
      );
    }

    const domain = resolveDomainFromRequest(req.headers, url.searchParams);

    if (!domain) {
      return Response.json(
        { error: { message: 'x-domain header or domain query is required', type: 'invalid_request' } },
        { status: 400 },
      );
    }

    let format: 'openai' | 'anthropic';
    let maxAttempts: number;

    try {
      format = resolveFormat(req.headers);
      maxAttempts = resolveRetryMaxFromHeader(req.headers, resolveDefaultRetryMax());
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      return Response.json(
        { error: { message, type: 'invalid_request' } },
        { status: 400 },
      );
    }

    const body = await readJsonBody(req);
    const sessionId = req.headers.get('x-session-id')?.trim() || '';
    const requestId = req.headers.get('x-request-id')?.trim() || '';
    const sessionKey = sessionId || '-';
    const requestKey = requestId || '-';

    console.log(
      `[llm-proxy] start sessionId=${sessionKey} requestId=${requestKey} domain=${domain} format=${format}`,
    );
    console.log(
      `[llm-proxy] upstream wait sessionId=${sessionKey} requestId=${requestKey}`,
    );

    const startedAt = Date.now();
    const completion = await withLlmCallRetry(
      () => callUpstream({
        body,
        domain,
        format,
        requestPath: url.pathname,
      }),
      { maxAttempts },
    );
    const durationMs = Date.now() - startedAt;

    console.log(
      `[llm-proxy] upstream done sessionId=${sessionKey} requestId=${requestKey} durationMs=${durationMs}`,
    );

    if (sessionId && requestId) {
      const assistant = (completion.choices as Array<{ message?: { content?: string | null; tool_calls?: unknown[] } }> | undefined)
        ?.[0]
        ?.message;
      const tags = mergeTags(
        parseTagsHeader(req.headers),
        assistant ? deriveModelResponseTags(assistant) : ['unknown'],
      );

      void postModelResponse({
        domain,
        durationMs,
        requestId,
        response: completion,
        sessionId,
        tags,
        thinkingMode: resolveThinkingMode(body),
      }).catch((error) => {
        const message = error instanceof Error ? error.message : String(error);

        console.error(`[llm-proxy] postback failed: ${message}`);
      });
    } else {
      console.warn('[llm-proxy] skipping usage postback; x-session-id and x-request-id required');
    }

    return Response.json(completion);
  } catch (error) {
    if (error instanceof LlmHttpError) {
      return new Response(error.bodyText || JSON.stringify({
        error: { message: error.message, type: 'upstream_error' },
      }), {
        headers: { 'content-type': 'application/json' },
        status: error.status >= 400 && error.status < 600 ? error.status : 502,
      });
    }

    const message = formatErrorCause(error);

    console.error(`[llm-proxy] error: ${message}`);

    return Response.json(
      { error: { message, type: 'llm_proxy_error' } },
      { status: 500 },
    );
  }
};
