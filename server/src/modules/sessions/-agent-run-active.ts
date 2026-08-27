import { execSync } from 'child_process';

import { resolveAgentContainerName } from './-agent-container-name';
import { modelSession } from './models';

export { resolveAgentContainerName } from './-agent-container-name';

export const isAgentContainerRunning = (sessionId: string): boolean => {
  const name = resolveAgentContainerName(sessionId);

  try {
    const output = execSync(
      `docker ps --filter name=^/${name}$ --filter status=running --format {{.Names}}`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
    ).trim();

    return output === name;
  } catch {
    return false;
  }
};

export const clearStaleLiveViewVncPort = async (sessionRef: string) => {
  await modelSession.updateOne(
    { _id: sessionRef },
    { $set: { liveViewVncPort: null } },
  );
};

export const assertSessionRunAllowed = async (session: {
  _id: string;
  browserAbandonedAt?: Date | string | null;
  liveViewVncPort?: number | null;
  sessionId: string;
}) => {
  if (session.browserAbandonedAt) {
    throw errors.conflict('Session browser was abandoned; resume is no longer available');
  }

  if (isAgentContainerRunning(session.sessionId)) {
    throw errors.conflict('Session already has an active agent run');
  }

  if (typeof session.liveViewVncPort === 'number' && session.liveViewVncPort > 0) {
    await clearStaleLiveViewVncPort(session._id);
  }
};

export const assertSessionResumeAllowed = assertSessionRunAllowed;
