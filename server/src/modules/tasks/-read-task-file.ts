import fs from 'fs/promises';

import { parseTaskMetadata } from './-parse-task-metadata';
import { taskYahlAbsolutePath, taskYahlRelativePath } from './-tasks-root';

export const readTaskFile = async (taskId: string) => {
  const yahlPath = taskYahlAbsolutePath(taskId);
  const yahl = await fs.readFile(yahlPath, 'utf8');
  const { description, name } = parseTaskMetadata(yahl);

  return {
    description,
    id: taskId,
    name,
    path: taskYahlRelativePath(taskId),
    taskId,
    yahl,
  };
};

export const taskExists = async (taskId: string) => {
  try {
    await fs.access(taskYahlAbsolutePath(taskId));

    return true;
  } catch {
    return false;
  }
};
