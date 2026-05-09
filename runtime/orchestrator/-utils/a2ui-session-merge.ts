export type A2uiMergeMode = "append" | "replace";

export type SessionA2uiState = {
  bySurface: Map<string, unknown[]>;
  surfaceOrder: string[];
};

export const createSessionA2uiState = (): SessionA2uiState => ({
  bySurface: new Map<string, unknown[]>(),
  surfaceOrder: [],
});

export const mergeSessionA2uiSurface = (
  state: SessionA2uiState,
  params: {
    envelopes: unknown[];
    maxPerSurface: number;
    mode: A2uiMergeMode;
    surfaceId: string;
  },
) => {
  const incoming = params.envelopes;
  if (!incoming.length) {
    return { nextCount: 0, prevCount: 0, truncated: false };
  }

  if (!state.bySurface.has(params.surfaceId)) {
    state.surfaceOrder.push(params.surfaceId);
  }

  const previous = state.bySurface.get(params.surfaceId) ?? [];
  const merged = params.mode === "append" ? [...previous, ...incoming] : [...incoming];
  const capped = merged.slice(0, params.maxPerSurface);
  state.bySurface.set(params.surfaceId, capped);

  return {
    nextCount: capped.length,
    prevCount: previous.length,
    truncated: merged.length > params.maxPerSurface,
  };
};

export const flattenSessionA2ui = (
  state: SessionA2uiState,
  maxTotal: number,
) => {
  const merged = state.surfaceOrder.flatMap((surfaceId) => state.bySurface.get(surfaceId) ?? []);
  const capped = merged.slice(0, maxTotal);
  return {
    envelopes: capped,
    truncated: merged.length > maxTotal,
  };
};
