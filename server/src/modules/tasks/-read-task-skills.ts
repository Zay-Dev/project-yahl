import path from 'path';

import { promises as fs } from 'fs';

import type { TTaskSkillFile } from '@project-yahl/shared/yahl/task-skills';

import { resolveTasksRoot } from './-tasks-root';

const taskSkillsDir = (taskId: string) =>
  path.join(resolveTasksRoot(), taskId, 'skills');

const sharedSkillsDir = () =>
  path.join(resolveTasksRoot(), '_shared', 'skills');

const walkSkillsDir = async (
  dir: string,
  root: string,
  files: TTaskSkillFile[],
) => {
  let entries;

  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  await Promise.all(entries.map(async (entry) => {
    const absolute = path.join(dir, entry.name);
    let st;

    try {
      st = await fs.stat(absolute);
    } catch {
      return;
    }

    if (st.isDirectory()) {
      await walkSkillsDir(absolute, root, files);
      return;
    }

    if (!st.isFile()) {
      return;
    }

    const content = await fs.readFile(absolute, 'utf8');
    const relative = path.relative(root, absolute).split(path.sep).join('/');

    files.push({ content, path: relative });
  }));
};

export const readTaskSkillsFromDisk = async (taskId: string): Promise<TTaskSkillFile[]> => {
  const sharedRoot = sharedSkillsDir();
  const taskRoot = taskSkillsDir(taskId);
  const byPath = new Map<string, TTaskSkillFile>();

  const sharedFiles: TTaskSkillFile[] = [];

  await walkSkillsDir(sharedRoot, sharedRoot, sharedFiles);

  for (const file of sharedFiles) {
    byPath.set(file.path, file);
  }

  const taskFiles: TTaskSkillFile[] = [];

  await walkSkillsDir(taskRoot, taskRoot, taskFiles);

  for (const file of taskFiles) {
    byPath.set(file.path, file);
  }

  return [...byPath.values()].sort((left, right) => left.path.localeCompare(right.path));
};
