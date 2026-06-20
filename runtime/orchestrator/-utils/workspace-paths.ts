import path from 'path';

import { promises as fs } from 'fs';

import config from '../config';

export const workspaceRoot = () =>
  process.env.WORKSPACE_ROOT?.trim()
  || path.resolve(config.__dirname, '../../workspace');

export const sessionWorkspaceRoot = (sessionId: string) =>
  path.join(workspaceRoot(), 'sessions', sessionId);

export const planFilePath = (sessionId: string, requestId: string) =>
  path.join(sessionWorkspaceRoot(sessionId), 'plans', `${requestId}.md`);

export const planBacklogFilePath = (sessionId: string, requestId: string) =>
  path.join(sessionWorkspaceRoot(sessionId), 'plans', 'backlog', `${requestId}.md`);

export const produceKeysDiagnosticPath = (
  sessionId: string,
  requestId: string,
  attempt: number,
) =>
  path.join(
    sessionWorkspaceRoot(sessionId),
    'diagnostics',
    'produce-keys',
    `${requestId}-${attempt}.md`,
  );

export const produceKeysDiagnosticAgentPath = (requestId: string, attempt: number) =>
  `~/diagnostics/produce-keys/${requestId}-${attempt}.md`;

export const planAgentPath = (requestId: string) =>
  `~/plans/${requestId}.md`;

export const ensureSessionWorkspace = async (sessionId: string) => {
  const root = sessionWorkspaceRoot(sessionId);

  await Promise.all([
    fs.mkdir(path.join(root, 'plans', 'backlog'), { recursive: true }),
    fs.mkdir(path.join(root, 'diagnostics', 'produce-keys'), { recursive: true }),
  ]);
};
