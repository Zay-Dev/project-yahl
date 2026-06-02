export type TSessionSummary = {
  _id: string;
  createdAt: string;
  deletedAt?: string;
  sessionId: string;
  taskYahlPath?: string;
  tokenTotals: {
    cacheHitTokens: number;
    cacheMissTokens: number;
    completionTokens: number;
    promptTokens: number;
    reasoningTokens: number;
    totalTokens: number;
  } | null;
  updatedAt: string;
};

export type TSessionDetail = TSessionSummary & {
  result?: unknown;
};

export type TPingResponse = {
  message: string;
};
