export type TPingResponse = {
  message: string;
};

export type TServerHealthResponse = {
  mastermind: { agent?: string; error?: string; ok: boolean };
  mongo: { ok: boolean; readyState: number };
  ok: boolean;
  service: 'server';
};
