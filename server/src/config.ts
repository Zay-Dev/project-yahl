import type { TServerType } from '@/servers';

import path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

type TConfig = {
  cookieParser: {
    secret: string;
  };
  corsOrigin: string[] | true;
  cwd: string;
  hideErrorStack: boolean;
  knowledgeDataRoot: string;
  mongoDb: {
    url: string;
  };
  requestTimeoutInSeconds: number;
  servers: Map<TServerType, { port: number }>;
};

const resolveKnowledgeDataRoot = (cwd: string): string => {
  const explicit = process.env.KNOWLEDGE_DATA_ROOT?.trim();

  if (explicit) {
    return path.resolve(explicit);
  }

  const hostRoot = process.env.HOST_REPO_ROOT?.trim();

  if (hostRoot) {
    return path.join(hostRoot, 'data/mastermind');
  }

  return path.resolve(cwd, '../data/mastermind');
};

const corsOrigin = (process.env.CORS_ORIGIN || '').split(',').filter(Boolean);

const mongoDb: TConfig['mongoDb'] = {
  url: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/yahl',
};

const servers: TConfig['servers'] = new Map([
  ['exposed', { port: parseInt(process.env.EXPOSED_SERVER_PORT || process.env.PORT || '4000', 10) }],
]);

const cwd = path.resolve(import.meta.dirname, '..');

export const config: TConfig = {
  cookieParser: {
    secret: process.env.COOKIE_PARSER_SECRET || 'dev-cookie-secret',
  },
  corsOrigin: corsOrigin.length > 0 ? corsOrigin : true,
  cwd,
  hideErrorStack: process.env.HIDE_ERROR_STACK === 'true',
  knowledgeDataRoot: resolveKnowledgeDataRoot(cwd),
  mongoDb,
  requestTimeoutInSeconds: parseInt(process.env.REQUEST_TIMEOUT_IN_SECONDS || '60', 10),
  servers,
};

export default config;
