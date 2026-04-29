export type SessionListItem = {
  createdAt: string;
  finalizedAt: string | null;
  sessionId: string;
  totalCalls: number;
  totalCost: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  updatedAt: string;
};

export type SessionDetail = {
  createdAt: string;
  events: Array<{
    model: string;
    requestId: string;
    timestamp: string;
    usage: {
      cacheHitTokens: number;
      cacheMissTokens: number;
      completionTokens: number;
      reasoningTokens: number;
    };
  }>;
  finalizedAt?: string;
  modelAggregates: Record<string, {
    cacheHitTokens: number;
    cacheMissTokens: number;
    calls: number;
    completionTokens: number;
    cost: number;
    reasoningTokens: number;
  }>;
  sessionId: string;
  updatedAt: string;
};
