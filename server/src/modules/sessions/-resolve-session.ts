import { Repository } from '@/core';

import type { Types } from 'mongoose';

import type { ISession } from './-types';

export type TResolvedSession = ISession & { _id: Types.ObjectId };

export const resolveSessionBySessionId = async (sessionId: string): Promise<TResolvedSession> => {
  const session = await Repository.resolve('validateSessionById')(sessionId);

  return session as TResolvedSession;
};
