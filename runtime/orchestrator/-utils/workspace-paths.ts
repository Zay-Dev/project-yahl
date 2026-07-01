import path from 'path';

import { promises as fs } from 'fs';

import config from '../config';
import { repoRoot } from '../-docker/paths';

export const workspaceRoot = () =>
  process.env.WORKSPACE_ROOT?.trim()
  || path.resolve(config.__dirname, '../../workspace');

export const sessionWorkspaceRoot = (sessionId: string) =>
  path.join(workspaceRoot(), 'sessions', sessionId);

export const taskSkillsSourceDir = (taskId: string) =>
  path.join(repoRoot, 'server', 'tasks', taskId, 'skills');

export type TMountTaskSkillsResult = {
  mounted: boolean;
  source: string;
  target: string;
};

export const mountTaskSkillsToSession = async (
  sessionId: string,
  taskId: string,
): Promise<TMountTaskSkillsResult> => {
  const source = taskSkillsSourceDir(taskId);
  const target = path.join(sessionWorkspaceRoot(sessionId), 'task-skills');

  try {
    await fs.access(source);
  } catch {
    console.warn(
      `[orchestrator] task-skills source missing taskId=${taskId} path=${source}`,
    );

    return { mounted: false, source, target };
  }

  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.cp(source, target, { recursive: true, force: true });

  console.log(`[orchestrator] task-skills mounted sessionId=${sessionId} target=${target}`);

  return { mounted: true, source, target };
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
