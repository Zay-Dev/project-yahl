import path from 'path';

import config from '../config';

export const workspaceRoot = () =>
  process.env.WORKSPACE_ROOT?.trim()
  || path.resolve(config.__dirname, '../../workspace');

export const planFilePath = (requestId: string) =>
  path.join(workspaceRoot(), 'plans', `${requestId}.md`);

export const planBacklogFilePath = (requestId: string) =>
  path.join(workspaceRoot(), 'plans', 'backlog', `${requestId}.md`);

export const produceKeysDiagnosticPath = (requestId: string, attempt: number) =>
  path.join(workspaceRoot(), 'diagnostics', 'produce-keys', `${requestId}-${attempt}.md`);

export const produceKeysDiagnosticAgentPath = (requestId: string, attempt: number) =>
  `~/diagnostics/produce-keys/${requestId}-${attempt}.md`;

export const planAgentPath = (requestId: string) =>
  `~/plans/${requestId}.md`;
