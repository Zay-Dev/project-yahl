import path from 'path';
import { fileURLToPath } from 'url';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

const readConfig = () => ({
  dataRoot: process.env.MASTERMIND_DATA_ROOT?.trim() || '/data',
  internalToken: process.env.MASTERMIND_INTERNAL_TOKEN?.trim() ?? '',
  knowledgeExportRoot: process.env.KNOWLEDGE_EXPORT_ROOT?.trim() || '/data/knowledge_export',
  port: Number(process.env.MASTERMIND_PORT?.trim() || '4100'),
  repoRoot: process.env.HOST_REPO_ROOT?.trim()
    || path.resolve(moduleDir, '../..'),
  sessionApiBaseUrl: (process.env.SESSION_API_BASE_URL?.trim() || 'http://server:4000').replace(/\/+$/, ''),
  wikiApiToken: process.env.WIKI_API_TOKEN?.trim() ?? '',
  wikiExportBytesThreshold: Number(process.env.WIKI_EXPORT_BYTES_THRESHOLD?.trim() || String(256 * 1024)),
  wikiExportPageThreshold: Number(process.env.WIKI_EXPORT_PAGE_THRESHOLD?.trim() || '10'),
  wikiGraphqlUrl: (process.env.WIKI_GRAPHQL_URL?.trim() || 'http://wiki:3000/graphql').replace(/\/+$/, ''),
  workspaceRoot: process.env.WORKSPACE_ROOT?.trim() || '/workspace',
});

export type TConfig = ReturnType<typeof readConfig>;

export const config: TConfig = new Proxy({} as TConfig, {
  get(_target, prop) {
    return readConfig()[prop as keyof TConfig];
  },
});

const readPaths = () => ({
  crashReports: path.join(config.dataRoot, 'crash-reports'),
  docs: path.join(config.dataRoot, 'docs'),
  knowledges: path.join(config.dataRoot, 'knowledges'),
  knowledgeExport: config.knowledgeExportRoot,
  rules: path.join(config.dataRoot, 'rules'),
  store: path.join(config.dataRoot, 'store'),
  topicsRegistry: path.join(config.dataRoot, 'topics.json'),
});

export type TPaths = ReturnType<typeof readPaths>;

export const paths: TPaths = new Proxy({} as TPaths, {
  get(_target, prop) {
    return readPaths()[prop as keyof TPaths];
  },
});
