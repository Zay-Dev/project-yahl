const sessionApiBaseUrl = () =>
  (process.env.SESSION_API_BASE_URL?.trim() || 'http://127.0.0.1:4000')
    .replace(/\/+$/, '');

export const postVerifyCheckpoint = async (
  sessionId: string,
  body: Record<string, unknown>,
): Promise<{ verifyId: string }> => {
  const res = await fetch(
    `${sessionApiBaseUrl()}/api/sessions/${encodeURIComponent(sessionId)}/verify-checkpoints`,
    {
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`verify checkpoint failed: ${res.status} ${text}`);
  }

  return await res.json() as { verifyId: string };
};

export const fetchVerifyCheckpoint = async (
  sessionId: string,
  verifyId: string,
) => {
  const res = await fetch(
    `${sessionApiBaseUrl()}/api/sessions/${encodeURIComponent(sessionId)}/verify-checkpoints/${encodeURIComponent(verifyId)}`,
  );

  if (!res.ok) {
    throw new Error(`verify checkpoint not found: ${verifyId}`);
  }

  return await res.json() as Record<string, unknown>;
};
