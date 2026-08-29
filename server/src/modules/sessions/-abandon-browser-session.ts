import { execSync } from 'child_process';

import { clearSessionControl } from './-session-control-redis';
import {
  modelAskUserQuestion,
  modelSession,
  modelUserPauseCheckpoint,
  modelVerifyCheckpoint,
} from './models';

export type TBrowserAbandonedReason = 'stop' | 'terminal' | 'ttl';

export const resolveBrowserContainerName = (sessionId: string) => `browser-${sessionId}`;

export const tearDownBrowserContainer = (sessionId: string) => {
  const name = resolveBrowserContainerName(sessionId);

  try {
    execSync(`docker rm -f ${name}`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch {
    // container may already be gone
  }
};

export const markSessionBrowserAbandoned = async (
  sessionRef: string,
  sessionId: string,
  reason: TBrowserAbandonedReason,
) => {
  const now = new Date();

  await modelSession.updateOne(
    { _id: sessionRef },
    {
      $set: {
        browserAbandonedAt: now,
        browserAbandonedReason: reason,
        liveViewVncPort: null,
      },
      $unset: { runCursor: '' },
    },
  );

  await Promise.all([
    modelVerifyCheckpoint.updateMany(
      { session: sessionRef, status: 'pending' },
      { $set: { status: 'superseded' } },
    ),
    modelAskUserQuestion.updateMany(
      { session: sessionRef, status: 'pending' },
      { $set: { status: 'superseded' } },
    ),
    modelUserPauseCheckpoint.updateMany(
      { session: sessionRef, status: 'pending' },
      { $set: { status: 'superseded' } },
    ),
  ]);

  await clearSessionControl(sessionId);
};
