import fs from 'fs';
import path from 'path';

import { promises as fsPromises } from 'fs';

const CONTAINER_RUNTIME = `/omniflex/${process.env.OMNIFLEX_APP_DIR?.trim() || 'project-yahl'}/runtime`;

export const SESSION_ID_PATTERN = /^[a-zA-Z0-9_.-]+$/;

export const TASK_ID_PATTERN = /^[a-zA-Z0-9_.-]+$/;

export const SESSION_TASK_DATA_DIR = 'data';

export type TWorkspaceLogTag = 'orchestrator' | 'sessions';

const _findProjectYahlRoot = (startDir: string) => {
  let current = path.resolve(startDir);

  for (let depth = 0; depth < 10; depth += 1) {
    const runtimePkg = path.join(current, 'runtime', 'package.json');

    if (fs.existsSync(runtimePkg)) {
      return current;
    }

    const parent = path.dirname(current);

    if (parent === current) {
      break;
    }

    current = parent;
  }

  return startDir;
};

const _resolveRuntimeDir = () => {
  const runtimeRoot = process.env.RUNTIME_REPO_ROOT?.trim()
    || process.env.YAHL_REPO_ROOT?.trim();

  if (runtimeRoot && fs.existsSync(path.join(path.resolve(runtimeRoot), 'package.json'))) {
    return path.resolve(runtimeRoot);
  }

  if (fs.existsSync(path.join(CONTAINER_RUNTIME, 'package.json'))) {
    return CONTAINER_RUNTIME;
  }

  return path.join(_findProjectYahlRoot(process.cwd()), 'runtime');
};

const _resolveRepoRoot = () => path.dirname(_resolveRuntimeDir());

export const resolveDataWorkspaceRoot = () => {
  const explicit = process.env.WORKSPACE_ROOT?.trim();

  if (explicit) {
    return explicit;
  }

  if (process.env.RUNTIME_REPO_ROOT?.trim()) {
    return '/workspace';
  }

  return path.join(_resolveRepoRoot(), 'data', 'workspace');
};

export const sessionWorkspaceRoot = (sessionId: string) =>
  path.join(resolveDataWorkspaceRoot(), 'sessions', sessionId);

export const taskWorkspaceRoot = (taskId: string) =>
  path.join(resolveDataWorkspaceRoot(), 'tasks', taskId);

export const sessionTaskDataPath = (sessionId: string) =>
  path.join(sessionWorkspaceRoot(sessionId), 'data');

export const TASK_SCRIPTS_DIR = 'scripts';

export const taskScriptsDir = (taskId: string) =>
  path.join(taskWorkspaceRoot(taskId), TASK_SCRIPTS_DIR);

export const ensureTaskWorkspace = async (
  taskId: string,
  logTag: TWorkspaceLogTag = 'orchestrator',
) => {
  const trimmed = taskId.trim();

  if (!trimmed || !TASK_ID_PATTERN.test(trimmed)) {
    throw new Error(`[${logTag}] invalid taskId=${JSON.stringify(taskId)}`);
  }

  await fsPromises.mkdir(taskWorkspaceRoot(trimmed), { recursive: true });
  await fsPromises.mkdir(taskScriptsDir(trimmed), { recursive: true });
};

const _unlinkSessionTaskData = async (sessionRoot: string) => {
  const dataPath = path.join(sessionRoot, SESSION_TASK_DATA_DIR);

  try {
    const stat = await fsPromises.lstat(dataPath);

    if (stat.isSymbolicLink()) {
      await fsPromises.unlink(dataPath);
    }
  } catch {
    // absent or not a symlink
  }
};

const _removeSessionWorkspaceEntries = async (sessionRoot: string) => {
  let entries: string[];

  try {
    entries = await fsPromises.readdir(sessionRoot);
  } catch {
    return;
  }

  await Promise.all(entries.map(async (entry) => {
    if (entry === SESSION_TASK_DATA_DIR) {
      return;
    }

    await fsPromises.rm(path.join(sessionRoot, entry), { force: true, recursive: true });
  }));
};

const _removeEmptyTaskDataDir = async (sessionRoot: string) => {
  const dataPath = path.join(sessionRoot, SESSION_TASK_DATA_DIR);

  try {
    const stat = await fsPromises.lstat(dataPath);

    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      return;
    }

    await fsPromises.rmdir(dataPath);
  } catch {
    // non-empty bind mount or absent
  }
};

export type TCopySessionWorkspaceResult = {
  copied: boolean;
  path: string;
};

export const copySessionWorkspace = async (
  sourceSessionId: string,
  targetSessionId: string,
  logTag: TWorkspaceLogTag = 'sessions',
): Promise<TCopySessionWorkspaceResult> => {
  const sourceRoot = sessionWorkspaceRoot(sourceSessionId.trim());
  const targetRoot = sessionWorkspaceRoot(targetSessionId.trim());

  try {
    await fsPromises.access(sourceRoot);
  } catch {
    return { copied: false, path: targetRoot };
  }

  await fsPromises.cp(sourceRoot, targetRoot, {
    force: true,
    recursive: true,
    filter: (src) => {
      const relative = path.relative(sourceRoot, src);

      return relative !== SESSION_TASK_DATA_DIR
        && !relative.startsWith(`${SESSION_TASK_DATA_DIR}${path.sep}`);
    },
  });
  console.log(
    `[${logTag}] session workspace copied source=${sourceSessionId} target=${targetSessionId} path=${targetRoot}`,
  );

  return { copied: true, path: targetRoot };
};

export type TRemoveSessionWorkspaceResult = {
  path: string;
  removed: boolean;
};

export const removeSessionWorkspace = async (
  sessionId: string,
  logTag: TWorkspaceLogTag = 'orchestrator',
): Promise<TRemoveSessionWorkspaceResult> => {
  const trimmed = sessionId.trim();
  const root = sessionWorkspaceRoot(trimmed);

  if (!trimmed || !SESSION_ID_PATTERN.test(trimmed)) {
    console.warn(
      `[${logTag}] session workspace cleanup skipped invalid sessionId=${JSON.stringify(sessionId)}`,
    );

    return { path: root, removed: false };
  }

  try {
    await _unlinkSessionTaskData(root);
    await _removeSessionWorkspaceEntries(root);
    await _removeEmptyTaskDataDir(root);
    await fsPromises.rmdir(root);
    console.log(
      `[${logTag}] session workspace removed sessionId=${trimmed} path=${root}`,
    );

    return { path: root, removed: true };
  } catch (error) {
    console.warn(
      `[${logTag}] session workspace cleanup failed sessionId=${trimmed} path=${root}: ${String(error)}`,
    );

    return { path: root, removed: false };
  }
};
