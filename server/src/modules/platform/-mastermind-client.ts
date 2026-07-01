import config from '@/config';

const mastermindInternalHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const token = process.env.MASTERMIND_INTERNAL_TOKEN?.trim();

  if (token) {
    headers['X-Internal-Token'] = token;
  }

  return headers;
};

export const fetchMastermindJson = async <T>(
  path: string,
  init?: RequestInit,
): Promise<T> => {
  const url = `${config.mastermindApiUrl}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      ...mastermindInternalHeaders(),
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`mastermind ${path} failed (${res.status})${detail ? `: ${detail}` : ''}`);
  }

  return res.json() as Promise<T>;
};
