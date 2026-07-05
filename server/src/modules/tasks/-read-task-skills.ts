import path from 'path';

import { promises as fs } from 'fs';

import type { TTaskSkillFile } from '@project-yahl/shared/yahl/task-skills';

import { resolveTasksRoot } from './-tasks-root';

const taskSkillsDir = (taskId: string) =>
  path.join(resolveTasksRoot(), taskId, 'skills');

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

    if (entry.isDirectory()) {
      await walkSkillsDir(absolute, root, files);
      return;
    }

    if (!entry.isFile()) {
      return;
    }

    const content = await fs.readFile(absolute, 'utf8');
    const relative = path.relative(root, absolute).split(path.sep).join('/');

    files.push({ content, path: relative });
  }));
};

export const readTaskSkillsFromDisk = async (taskId: string): Promise<TTaskSkillFile[]> => {
  const root = taskSkillsDir(taskId);
  const files: TTaskSkillFile[] = [];

  await walkSkillsDir(root, root, files);

  return files.sort((left, right) => left.path.localeCompare(right.path));
};
