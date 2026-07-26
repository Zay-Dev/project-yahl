import type { TTaskSkillFile } from '@project-yahl/shared/yahl/task-skills';

import path from 'path';

import { promises as fs } from 'fs';

import {
  ensureTaskWorkspace as ensureTaskWorkspaceShared,
  removeSessionWorkspace as removeSessionWorkspaceShared,
  resolveDataWorkspaceRoot,
  sessionTaskDataPath,
  sessionWorkspaceRoot,
  taskWorkspaceRoot,
} from '@project-yahl/shared/yahl/workspace-paths';

export {
  SESSION_TASK_DATA_DIR,
  sessionTaskDataPath,
  sessionWorkspaceRoot,
  taskWorkspaceRoot,
} from '@project-yahl/shared/yahl/workspace-paths';

export type { TRemoveSessionWorkspaceResult } from '@project-yahl/shared/yahl/workspace-paths';

export const workspaceRoot = resolveDataWorkspaceRoot;

export const taskDataSymlinkRelative = (taskId: string) =>
  path.join('..', '..', 'tasks', taskId);

export const ensureTaskWorkspace = (taskId: string) =>
  ensureTaskWorkspaceShared(taskId, 'orchestrator');

export type TEnsureTaskDataSymlinkResult = {
  created: boolean;
  path: string;
};

export const ensureTaskDataSymlink = async (
  sessionId: string,
  taskId: string,
): Promise<TEnsureTaskDataSymlinkResult> => {
  const dataPath = sessionTaskDataPath(sessionId.trim());

  try {
    await fs.lstat(dataPath);

    return { created: false, path: dataPath };
  } catch {
    // absent — create symlink below
  }

  await ensureTaskWorkspace(taskId);
  await fs.symlink(taskDataSymlinkRelative(taskId.trim()), dataPath);

  console.log(
    `[orchestrator] task data symlink created sessionId=${sessionId} `
    + `taskId=${taskId} path=${dataPath}`,
  );

  return { created: true, path: dataPath };
};

export const removeSessionWorkspace = (sessionId: string) =>
  removeSessionWorkspaceShared(sessionId, 'orchestrator');

export type TEchoTaskSkillsResult = {
  echoed: boolean;
  fileCount: number;
  target: string;
};

export const echoTaskSkillsToSession = async (
  sessionId: string,
  files: TTaskSkillFile[],
): Promise<TEchoTaskSkillsResult> => {
  const target = path.join(sessionWorkspaceRoot(sessionId), 'task-skills');

  if (!files.length) {
    console.warn(
      `[orchestrator] task-skills echo skipped sessionId=${sessionId} fileCount=0`,
    );

    return { echoed: false, fileCount: 0, target };
  }

  await Promise.all(files.map(async (file) => {
    const absolute = path.join(target, file.path);

    await fs.mkdir(path.dirname(absolute), { recursive: true });
    await fs.writeFile(absolute, file.content, 'utf8');
  }));

  console.log(
    `[orchestrator] task-skills echoed sessionId=${sessionId} `
    + `target=${target} fileCount=${files.length}`,
  );

  return { echoed: true, fileCount: files.length, target };
};

export const taskMissionSkillPath = (sessionId: string) =>
  path.join(sessionWorkspaceRoot(sessionId), 'task-skills', 'task-mission', 'SKILL.md');

export const mergeTaskSystemAppend = async (
  _sessionId: string,
  _taskId: string | undefined,
  existing?: string,
) => existing;

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

export const verifyTaskSkillsMount = async (target: string) => {
  try {
    await fs.access(path.join(target, 'task-mission', 'SKILL.md'));

    return true;
  } catch {
    return false;
  }
};
