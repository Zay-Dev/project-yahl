import { pruneIdleBrowsers, shutdownBrowser } from './compose-browser';

export type TBrowserAbandonedReason = 'stop' | 'terminal' | 'ttl';

const sessionApiBaseUrl = () =>
  (process.env.SESSION_API_BASE_URL?.trim() || 'http://127.0.0.1:4000').replace(/\/+$/, '');

export const abandonBrowserSession = async (
  sessionId: string,
  reason: TBrowserAbandonedReason,
) => {
  const trimmed = sessionId.trim();

  if (!trimmed) {
    return;
  }

  await shutdownBrowser(trimmed);

  const response = await fetch(
    `${sessionApiBaseUrl()}/api/sessions/${encodeURIComponent(trimmed)}/abandon-browser`,
    {
      body: JSON.stringify({ reason }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    },
  );

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(
      `abandon-browser failed sessionId=${trimmed} status=${response.status} ${text.slice(0, 240)}`,
    );
  }
};

export const pruneIdleBrowsersAndAbandon = async () => {
  const result = await pruneIdleBrowsers(async (sessionId) => {
    try {
      await abandonBrowserSession(sessionId, 'ttl');
    } catch (error) {
      console.error(`[browser] ttl abandon failed sessionId=${sessionId}:`, error);
      await shutdownBrowser(sessionId);
    }
  });

  if (result.abandoned.length) {
    console.log(
      `[browser] pruned idle sidecars count=${result.abandoned.length} sessions=${result.abandoned.join(',')}`,
    );
  }

  return result;
};
