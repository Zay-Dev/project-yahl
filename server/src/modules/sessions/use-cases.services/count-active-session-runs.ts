import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

import { isOrchestratorActive } from '../-session-run-state';

const LOCK_PREFIX = 'yahl-orchestrator-';
const LOCK_SUFFIX = '.run.lock';

const listRunningAgentSessionIds = (): string[] => {
  try {
    const output = execFileSync(
      'docker',
      ['ps', '--filter', 'status=running', '--format', '{{.Names}}'],
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 4000 },
    );

    return output
      .split('\n')
      .map((name) => name.trim())
      .filter((name) => name.startsWith('agent-'))
      .map((name) => name.slice('agent-'.length))
      .filter(Boolean);
  } catch {
    return [];
  }
};

const listLiveOrchestratorSessionIds = (): string[] => {
  let names: string[] = [];

  try {
    names = fs.readdirSync('/tmp');
  } catch {
    return [];
  }

  const ids: string[] = [];

  for (const name of names) {
    if (!name.startsWith(LOCK_PREFIX) || !name.endsWith(LOCK_SUFFIX)) {
      continue;
    }

    const sessionId = name.slice(LOCK_PREFIX.length, name.length - LOCK_SUFFIX.length);

    if (sessionId && isOrchestratorActive(sessionId)) {
      ids.push(sessionId);
    }
  }

  return ids;
};

export const countActiveSessionRuns = async (): Promise<number> => {
  const ids = new Set([
    ...listRunningAgentSessionIds(),
    ...listLiveOrchestratorSessionIds(),
  ]);

  return ids.size;
};
