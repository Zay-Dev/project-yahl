import { readQuotaState } from './-quota-state';

export const isQuotaExhausted = (): boolean => {
  const state = readQuotaState();

  return state?.exhausted ?? false;
};
