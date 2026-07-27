export const config = {
  cronRefreshMs: Number(process.env.WORKER_CRON_REFRESH_MS?.trim() || '60000'),
  healthPort: Number(process.env.WORKER_HEALTH_PORT?.trim() || '4091'),
  pollIntervalMs: Number(process.env.WORKER_POLL_INTERVAL_MS?.trim() || '5000'),
  sessionApiBaseUrl: (process.env.SESSION_API_BASE_URL?.trim() || 'http://server:4000').replace(/\/+$/, ''),
  whatsappSendTimeoutMs: Number(process.env.WORKER_WHATSAPP_SEND_TIMEOUT_MS?.trim() || '45000'),
  workspaceRoot: process.env.WORKSPACE_ROOT?.trim() || '/workspace',
};
