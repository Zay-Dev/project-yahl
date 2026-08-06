export const resolveNixeryInlineRetryMax = () => {
  const raw = Number(process.env.YAHL_NIXERY_INLINE_RETRY_MAX ?? 3);

  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 3;
};

export const resolveNixerySoftFailToolResult = (params: {
  maxRetries: number;
  result: Record<string, unknown> & { ok: boolean };
  softFailCount: number;
}): { hasError: boolean; result: string } => {
  if (params.result.ok) {
    return {
      hasError: false,
      result: JSON.stringify(params.result),
    };
  }

  if (params.softFailCount > params.maxRetries) {
    return {
      hasError: false,
      result: JSON.stringify({
        ...params.result,
        abandoned: true,
      }),
    };
  }

  return {
    hasError: false,
    result: JSON.stringify({
      ...params.result,
      retryRemaining: params.maxRetries - params.softFailCount,
    }),
  };
};
