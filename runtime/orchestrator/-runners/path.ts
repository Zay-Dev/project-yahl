import path from 'path';
import fs from 'fs/promises';

import config from '@/orchestrator/config';
import { runYahl } from '@/orchestrator/-agent';
import { extractYahl } from '@/orchestrator/-utils/yahl';

const _getFilePath = async (taskPathRaw: string) => {
  const taskPath = path.resolve(
    config.__dirname,
    'orchestrator',
    'TASKS',
    taskPathRaw,
  );

  const isFile = await fs.stat(taskPath)
    .then(stat => stat.isFile());

  if (isFile) {
    return taskPath;
  }

  const candidates = [
    path.resolve(taskPath, 'SKILL.yahl'),
    path.resolve(taskPath, 'SKILL.md'),
    path.resolve(taskPath, 'index.md'),
  ];

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch { }
  }

  throw new Error(`No task file found in ${taskPath}`);
};

export const runTaskPath = async (
  taskPathRaw: string,
) => {
  const taskPath = await _getFilePath(taskPathRaw);
  const task = await fs.readFile(taskPath, 'utf-8');

  const yahl = extractYahl(task);

  await runYahl(yahl);
};