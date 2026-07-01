import config from '@/config';

import mongoose from 'mongoose';

const HEALTH_FETCH_TIMEOUT_MS = 5_000;

export type TMastermindHealthProbe = {
  agent?: string;
  error?: string;
  ok: boolean;
};

export type TServerHealthResponse = {
  mastermind: TMastermindHealthProbe;
  mongo: { ok: boolean; readyState: number };
  ok: boolean;
  service: 'server';
};

export const probeMastermindHealth = async (): Promise<TMastermindHealthProbe> => {
  const url = `${config.mastermindApiUrl}/health`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(HEALTH_FETCH_TIMEOUT_MS) });
    const body = await res.json() as { agent?: string; ok?: boolean };

    if (!res.ok || body.ok !== true) {
      return {
        agent: body.agent,
        error: `mastermind health returned ${res.status}`,
        ok: false,
      };
    }

    return { agent: body.agent, ok: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'mastermind unreachable',
      ok: false,
    };
  }
};

export const buildServerHealth = async (): Promise<TServerHealthResponse> => {
  const mongoReadyState = mongoose.connection.readyState;
  const mongoOk = mongoReadyState === 1;
  const mastermind = await probeMastermindHealth();

  return {
    mastermind,
    mongo: { ok: mongoOk, readyState: mongoReadyState },
    ok: mongoOk && mastermind.ok,
    service: 'server',
  };
};
