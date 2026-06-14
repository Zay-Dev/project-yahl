import { Repository } from '@/core';

import type { ISession } from './-types';

export const resolveSessionBySessionId = async (sessionId: string) => {
  const session = await Repository.resolve('validateSessionById')(sessionId);

  return session as ISession & { _id: unknown };
};
