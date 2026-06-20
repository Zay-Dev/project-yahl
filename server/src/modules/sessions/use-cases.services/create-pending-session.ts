import { emitSessionEvent } from '../-session-events';
import { pendingSessionUpdateDoc } from '../-pending-session-update';
import { modelSession } from '../models';

export type { TCreatePendingSessionInput } from '../-pending-session-update';

export const createPendingSession = async (
  input: Parameters<typeof pendingSessionUpdateDoc>[0],
) => {
  const now = new Date();

  await modelSession.updateOne(
    { sessionId: input.sessionId },
    pendingSessionUpdateDoc(input, now),
    { upsert: true },
  );

  emitSessionEvent(input.sessionId, { type: 'session.updated' });
};
