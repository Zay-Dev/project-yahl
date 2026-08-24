import { execSync } from 'child_process';
import fs from 'fs';

import {
  clearStaleLiveViewVncPort,
  resolveAgentContainerName,
} from './-agent-run-active';
import { orchestratorRunLockPath } from './-orchestrator-run-lock';
import { clearSessionControl } from './-session-control-redis';

const _sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const _isProcessRunning = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

export const killOrchestratorProcess = async (sessionId: string) => {
  const lockPath = orchestratorRunLockPath(sessionId);

  if (!fs.existsSync(lockPath)) {
    return false;
  }

  const raw = fs.readFileSync(lockPath, 'utf8').trim();
  const pid = Number.parseInt(raw, 10);

  if (!Number.isFinite(pid)) {
    try {
      fs.unlinkSync(lockPath);
    } catch {
      // ignore stale lock cleanup races
    }

    return false;
  }

  if (_isProcessRunning(pid)) {
    process.kill(pid, 'SIGTERM');

    for (let attempt = 0; attempt < 30; attempt += 1) {
      if (!_isProcessRunning(pid)) {
        break;
      }

      await _sleep(100);
    }

    if (_isProcessRunning(pid)) {
      process.kill(pid, 'SIGKILL');
    }
  }

  try {
    fs.unlinkSync(lockPath);
  } catch {
    // ignore stale lock cleanup races
  }

  return true;
};

export const tearDownAgentContainer = (sessionId: string) => {
  const name = resolveAgentContainerName(sessionId);

  try {
    execSync(`docker rm -f ${name}`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch {
    // container may already be gone
  }
};

export const stopSessionRun = async (sessionRef: string, sessionId: string) => {
  await killOrchestratorProcess(sessionId);
  tearDownAgentContainer(sessionId);
  await clearStaleLiveViewVncPort(sessionRef);
  await clearSessionControl(sessionId);
};
