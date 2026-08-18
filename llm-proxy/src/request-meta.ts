export const normalizeDomain = (raw: string): string => {
  const trimmed = raw.trim();

  if (!trimmed) return '';

  try {
    const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const url = new URL(withScheme);

    return url.host;
  } catch {
    return trimmed
      .replace(/^https?:\/\//i, '')
      .split('/')[0]
      ?.split('?')[0]
      ?.trim()
      ?? '';
  }
};

export const resolveDomainFromRequest = (
  headers: Headers,
  searchParams: URLSearchParams,
): string | undefined => {
  const fromHeader = headers.get('x-domain')?.trim();
  const fromQuery = searchParams.get('domain')?.trim();
  const raw = fromHeader || fromQuery || '';

  if (!raw) return undefined;

  const domain = normalizeDomain(raw);

  return domain || undefined;
};

export const resolveRetryMaxFromHeader = (
  headers: Headers,
  defaultMax: number,
): number => {
  const raw = headers.get('x-llm-retry-max')?.trim();

  if (!raw) return defaultMax;

  const parsed = Math.floor(Number(raw));

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error('x-llm-retry-max must be an integer >= 0');
  }

  return parsed === 0 ? 1 : parsed;
};

export const resolveFormat = (headers: Headers): 'openai' | 'anthropic' => {
  const raw = (headers.get('x-format')?.trim() || 'openai').toLowerCase();

  if (raw === 'anthropic') return 'anthropic';
  if (raw === 'openai') return 'openai';

  throw new Error('x-format must be openai or anthropic');
};

export const parseTagsHeader = (headers: Headers): string[] => {
  const raw = headers.get('x-tags')?.trim();

  if (!raw) return [];

  return raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
};

export const isValidLlmProxyToken = (headers: Headers, expected: string) => {
  const provided = headers.get('x-llm-proxy-token')?.trim() ?? '';

  return Boolean(expected) && provided === expected;
};
