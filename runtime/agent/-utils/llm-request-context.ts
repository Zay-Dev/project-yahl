export type TLlmRequestContext = {
  format?: 'openai' | 'anthropic';
  requestId?: string;
  retryMax?: number;
  sessionId?: string;
  tags?: string[];
};

let context: TLlmRequestContext | null = null;

export const setLlmRequestContext = (next: TLlmRequestContext | null) => {
  context = next;
};

export const getLlmRequestContext = () => context;

export const clearLlmRequestContext = () => {
  context = null;
};

export const withLlmRequestContext = async <T>(
  next: TLlmRequestContext,
  fn: () => Promise<T>,
): Promise<T> => {
  const previous = context;

  context = { ...previous, ...next };

  try {
    return await fn();
  } finally {
    context = previous;
  }
};
