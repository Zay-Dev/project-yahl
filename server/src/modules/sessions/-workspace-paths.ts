import fs from 'fs';
import path from 'path';

import { promises as fsPromises } from 'fs';

const CONTAINER_RUNTIME = `/omniflex/${process.env.OMNIFLEX_APP_DIR?.trim() || 'project-yahl'}/runtime`;

const SESSION_ID_PATTERN = /^[a-zA-Z0-9_.-]+$/;

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

export const resolveWorkspaceRoot = () => {
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
  path.join(resolveWorkspaceRoot(), 'sessions', sessionId);

export type TCopySessionWorkspaceResult = {
  copied: boolean;
  path: string;
};

export const copySessionWorkspace = async (
  sourceSessionId: string,
  targetSessionId: string,
): Promise<TCopySessionWorkspaceResult> => {
  const sourceRoot = sessionWorkspaceRoot(sourceSessionId.trim());
  const targetRoot = sessionWorkspaceRoot(targetSessionId.trim());

  try {
    await fsPromises.access(sourceRoot);
  } catch {
    return { copied: false, path: targetRoot };
  }

  await fsPromises.cp(sourceRoot, targetRoot, { force: true, recursive: true });
  console.log(
    `[sessions] session workspace copied source=${sourceSessionId} target=${targetSessionId} path=${targetRoot}`,
  );

  return { copied: true, path: targetRoot };
};

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
      `[sessions] session workspace cleanup skipped invalid sessionId=${JSON.stringify(sessionId)}`,
    );

    return { path: root, removed: false };
  }

  try {
    await fsPromises.rm(root, { force: true, recursive: true });
    console.log(
      `[sessions] session workspace removed sessionId=${trimmed} path=${root}`,
    );

    return { path: root, removed: true };
  } catch (error) {
    console.warn(
      `[sessions] session workspace cleanup failed sessionId=${trimmed} path=${root}: ${String(error)}`,
    );

    return { path: root, removed: false };
  }
};
