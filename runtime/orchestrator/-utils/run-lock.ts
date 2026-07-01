import fs from 'fs';
import path from 'path';

export const orchestratorRunLockPath = (sessionId: string) =>
  path.join('/tmp', `yahl-orchestrator-${sessionId}.run.lock`);

export const acquireOrchestratorRunLock = (sessionId: string) => {
  fs.writeFileSync(orchestratorRunLockPath(sessionId), String(process.pid));
};

export const releaseOrchestratorRunLock = (sessionId: string) => {
  try {
    fs.unlinkSync(orchestratorRunLockPath(sessionId));
  } catch {
    // ignore missing lock during teardown races
  }
};
