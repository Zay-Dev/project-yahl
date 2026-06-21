import path from 'path';
import { fileURLToPath } from 'url';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

export const config = {
  apiKey: process.env.CURSOR_API_KEY?.trim() ?? '',
  batchRunsRoot: process.env.WORKER_BATCH_RUNS_ROOT?.trim() || '/tmp/yahl-batch-runs',
  cronRefreshMs: Number(process.env.WORKER_CRON_REFRESH_MS?.trim() || '60000'),
  mastermindApiUrl: (process.env.MASTERMIND_API_URL?.trim() || 'http://mastermind:4100').replace(/\/+$/, ''),
  pollIntervalMs: Number(process.env.WORKER_POLL_INTERVAL_MS?.trim() || '5000'),
  redisUrl: process.env.REDIS_URL?.trim() || 'redis://redis:6379',
  runtimeDir: process.env.RUNTIME_REPO_ROOT?.trim()
    || path.resolve(moduleDir, '../../runtime'),
  sessionApiBaseUrl: (process.env.SESSION_API_BASE_URL?.trim() || 'http://server:4000').replace(/\/+$/, ''),
};
