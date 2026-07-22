export const config = {
  cronRefreshMs: Number(process.env.WORKER_CRON_REFRESH_MS?.trim() || '60000'),
  pollIntervalMs: Number(process.env.WORKER_POLL_INTERVAL_MS?.trim() || '5000'),
  sessionApiBaseUrl: (process.env.SESSION_API_BASE_URL?.trim() || 'http://server:4000').replace(/\/+$/, ''),
  workspaceRoot: process.env.WORKSPACE_ROOT?.trim() || '/workspace',
};
