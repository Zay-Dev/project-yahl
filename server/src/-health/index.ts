import mongoose from 'mongoose';

export type TServerHealthResponse = {
  mongo: { ok: boolean; readyState: number };
  ok: boolean;
  service: 'server';
};

export const buildServerHealth = async (): Promise<TServerHealthResponse> => {
  const mongoReadyState = mongoose.connection.readyState;
  const mongoOk = mongoReadyState === 1;

  return {
    mongo: { ok: mongoOk, readyState: mongoReadyState },
    ok: mongoOk,
    service: 'server',
  };
};
