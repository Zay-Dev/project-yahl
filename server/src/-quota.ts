import { readQuotaState } from './-quota-state';

export const isQuotaExhausted = (): boolean => {
  const state = readQuotaState();

  return state?.exhausted ?? false;
};

export const assertQuotaAllowsSpawn = (): void => {
  if (isQuotaExhausted()) {
    throw errors.custom('token quota exhausted', 402);
  }
};
