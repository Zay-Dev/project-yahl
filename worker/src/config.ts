export const config = {
  apiKey: process.env.CURSOR_API_KEY?.trim() ?? '',
  batchRunsRoot: process.env.WORKER_BATCH_RUNS_ROOT?.trim() || '/tmp/yahl-batch-runs',
  cronRefreshMs: Number(process.env.WORKER_CRON_REFRESH_MS?.trim() || '60000'),
  pollIntervalMs: Number(process.env.WORKER_POLL_INTERVAL_MS?.trim() || '5000'),
  sessionApiBaseUrl: (process.env.SESSION_API_BASE_URL?.trim() || 'http://server:4000').replace(/\/+$/, ''),
  workspaceRoot: process.env.WORKSPACE_ROOT?.trim() || '/workspace',
};
