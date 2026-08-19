export type TPingResponse = {
  message: string;
};

export type TServerHealthResponse = {
  mongo: { ok: boolean; readyState: number };
  ok: boolean;
  service: 'server';
};
