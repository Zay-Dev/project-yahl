type TOneCliSecretRaw = {
  createdAt?: string;
  hostPattern?: string;
  id?: string;
  injectionConfig?: {
    headerName?: string;
    valueFormat?: string;
  } | null;
  name?: string;
  pathPattern?: string | null;
  preview?: string;
  type?: string;
};

const resolveApiPrefix = () => {
  const raw = (process.env.ONECLI_API_PREFIX || 'api').trim().replace(/^\/+|\/+$/g, '');

  return raw || 'api';
};

const resolveBaseUrl = () => {
  const raw = (process.env.ONECLI_DASHBOARD_URL || process.env.ONECLI_URL || 'http://onecli:10254')
    .trim()
    .replace(/\/+$/, '');

  return `${raw}/${resolveApiPrefix()}`;
};

const resolveApiKey = () => process.env.ONECLI_API_KEY?.trim() || '';

export const oneCliRequest = async <T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<{ data: T; status: number }> => {
  const apiKey = resolveApiKey();
  if (!apiKey) {
    throw errors.custom('ONECLI_API_KEY is not configured', 503);
  }

  const url = `${resolveBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    Accept: 'application/json',
  };

  const init: RequestInit = { method, headers };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  const res = await fetch(url, init);
  const text = await res.text();
  let data: T = undefined as T;

  if (text) {
    try {
      data = JSON.parse(text) as T;
    } catch {
      const snippet = text.replace(/\s+/g, ' ').slice(0, 120);
      throw errors.custom(
        `OneCLI returned non-JSON (${res.status}) for ${method} ${url}: ${snippet}`,
        502,
      );
    }
  }

  if (!res.ok) {
    const message =
      typeof data === 'object' && data && 'error' in data
        ? typeof (data as { error: unknown }).error === 'string'
          ? (data as { error: string }).error
          : JSON.stringify((data as { error: unknown }).error)
        : `OneCLI request failed (${res.status}) for ${method} ${url}`;

    if (res.status === 401 || res.status === 403) {
      throw errors.custom(message, res.status);
    }

    if (res.status === 404) {
      throw errors.notFound(message);
    }

    if (res.status >= 400 && res.status < 500) {
      throw errors.badRequest(message);
    }

    throw errors.custom(message, 502);
  }

  return { data, status: res.status };
};

export const normalizeSecretList = (payload: unknown): TOneCliSecretRaw[] => {
  if (Array.isArray(payload)) {
    return payload as TOneCliSecretRaw[];
  }

  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    if (Array.isArray(record.items)) {
      return record.items as TOneCliSecretRaw[];
    }
    if (Array.isArray(record.secrets)) {
      return record.secrets as TOneCliSecretRaw[];
    }
  }

  return [];
};

export type { TOneCliSecretRaw };
