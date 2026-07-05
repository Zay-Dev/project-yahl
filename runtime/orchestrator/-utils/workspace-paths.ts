import type { TTaskSkillFile } from '@project-yahl/shared/yahl/task-skills';

import path from 'path';

import { promises as fs } from 'fs';

import config from '../config';

export const workspaceRoot = () =>
  process.env.WORKSPACE_ROOT?.trim()
  || path.resolve(config.__dirname, '../../data/workspace');

export const sessionWorkspaceRoot = (sessionId: string) =>
  path.join(workspaceRoot(), 'sessions', sessionId);

const SESSION_ID_PATTERN = /^[a-zA-Z0-9_.-]+$/;

export type TRemoveSessionWorkspaceResult = {
  path: string;
  removed: boolean;
};

export const removeSessionWorkspace = async (
  sessionId: string,
): Promise<TRemoveSessionWorkspaceResult> => {
  const trimmed = sessionId.trim();
  const root = sessionWorkspaceRoot(trimmed);

  if (!trimmed || !SESSION_ID_PATTERN.test(trimmed)) {
    console.warn(
      `[orchestrator] session workspace cleanup skipped invalid sessionId=${JSON.stringify(sessionId)}`,
    );

    return { path: root, removed: false };
  }

  try {
    await fs.rm(root, { force: true, recursive: true });
    console.log(
      `[orchestrator] session workspace removed sessionId=${trimmed} path=${root}`,
    );

    return { path: root, removed: true };
  } catch (error) {
    console.warn(
      `[orchestrator] session workspace cleanup failed sessionId=${trimmed} path=${root}: ${String(error)}`,
    );

    return { path: root, removed: false };
  }
};

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

export const readTaskMissionPrompt = async (sessionId: string) => {
  const missionPath = taskMissionSkillPath(sessionId);

  try {
    const content = await fs.readFile(missionPath, 'utf8').then((text) => text.trim());

    if (!content) {
      return undefined;
    }

    return [
      '## Task mission',
      '',
      'Use this mission on every `/mastermind(design-questions|research|plan, mission: …)` call.',
      'Also readable at `~/task-skills/task-mission/SKILL.md`.',
      '',
      content.slice(0, 8_000),
    ].join('\n');
  } catch {
    return undefined;
  }
};

export const mergeTaskSystemAppend = async (
  sessionId: string,
  taskId: string | undefined,
  existing?: string,
) => {
  const mission = taskId ? await readTaskMissionPrompt(sessionId) : undefined;
  const parts = [mission, existing].filter(Boolean);

  return parts.length > 0 ? parts.join('\n\n') : undefined;
};

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
