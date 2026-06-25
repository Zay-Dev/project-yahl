import path from 'path';
import { fileURLToPath } from 'url';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

export const config = {
  apiKey: process.env.CURSOR_API_KEY?.trim() ?? '',
  dataRoot: process.env.MASTERMIND_DATA_ROOT?.trim() || '/data',
  internalToken: process.env.MASTERMIND_INTERNAL_TOKEN?.trim() ?? '',
  port: Number(process.env.MASTERMIND_PORT?.trim() || '4100'),
  repoRoot: process.env.HOST_REPO_ROOT?.trim()
    || path.resolve(moduleDir, '../..'),
  sessionApiBaseUrl: (process.env.SESSION_API_BASE_URL?.trim() || 'http://server:4000').replace(/\/+$/, ''),
  workspaceRoot: process.env.WORKSPACE_ROOT?.trim() || '/root',
};

export const paths = {
  crashReports: path.join(config.dataRoot, 'crash-reports'),
  docs: path.join(config.dataRoot, 'docs'),
  knowledges: path.join(config.dataRoot, 'knowledges'),
  rules: path.join(config.dataRoot, 'rules'),
  store: path.join(config.dataRoot, 'store'),
};
