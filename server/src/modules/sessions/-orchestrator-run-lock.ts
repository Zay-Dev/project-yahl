import fs from 'fs';
import path from 'path';

export const orchestratorRunLockPath = (sessionId: string) =>
  path.join('/tmp', `yahl-orchestrator-${sessionId}.run.lock`);

const _sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const _isProcessRunning = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

export const waitForOrchestratorIdle = async (
  sessionId: string,
  maxWaitMs = 120_000,
) => {
  const lockPath = orchestratorRunLockPath(sessionId);
  const deadline = Date.now() + maxWaitMs;

  while (Date.now() < deadline) {
    if (!fs.existsSync(lockPath)) {
      return;
    }

    const raw = fs.readFileSync(lockPath, 'utf8').trim();
    const pid = Number.parseInt(raw, 10);

    if (!Number.isFinite(pid) || !_isProcessRunning(pid)) {
      try {
        fs.unlinkSync(lockPath);
      } catch {
        // ignore stale lock cleanup races
      }

      return;
    }

    await _sleep(100);
  }

  throw errors.conflict('Prior orchestrator run still active');
};
