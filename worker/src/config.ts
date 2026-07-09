export const config = {
  apiKey: process.env.CURSOR_API_KEY?.trim() ?? '',
  batchRunsRoot: process.env.WORKER_BATCH_RUNS_ROOT?.trim() || '/tmp/yahl-batch-runs',
  cronRefreshMs: Number(process.env.WORKER_CRON_REFRESH_MS?.trim() || '60000'),
  healthPort: Number(process.env.WORKER_HEALTH_PORT?.trim() || '4200'),
  knowledgeQaChecklistRoot: process.env.KNOWLEDGE_QA_CHECKLIST_ROOT?.trim()
    || '/opt/knowledge-qa-checklist',
  mastermindApiUrl: (process.env.MASTERMIND_API_URL?.trim() || 'http://mastermind:4100').replace(/\/+$/, ''),
  pollIntervalMs: Number(process.env.WORKER_POLL_INTERVAL_MS?.trim() || '5000'),
  sessionApiBaseUrl: (process.env.SESSION_API_BASE_URL?.trim() || 'http://server:4000').replace(/\/+$/, ''),
  verifyCliMaxRetries: Number(process.env.VERIFY_CLI_MAX_RETRIES?.trim() || '2'),
  verifyRulesRoot: process.env.VERIFY_RULES_ROOT?.trim()
    || process.env.MASTERMIND_DATA_ROOT?.trim()
    || '/data',
  workerApiUrl: (process.env.WORKER_API_URL?.trim() || 'http://worker:4200').replace(/\/+$/, ''),
  workspaceRoot: process.env.WORKSPACE_ROOT?.trim() || '/workspace',
};
