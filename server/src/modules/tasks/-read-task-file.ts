import fs from 'fs/promises';

import { parseRunInputKeysFromYahl } from '@project-yahl/shared/yahl/run-input-keys';

import { parseTaskMetadata } from './-parse-task-metadata';
import { taskYahlAbsolutePath, taskYahlRelativePath } from './-tasks-root';

export const readTaskFile = async (taskId: string) => {
  const yahlPath = taskYahlAbsolutePath(taskId);
  const yahl = await fs.readFile(yahlPath, 'utf8');
  const { background, description, name } = parseTaskMetadata(yahl);
  const runInputKeys = parseRunInputKeysFromYahl(yahl);

  return {
    background,
    description,
    id: taskId,
    name,
    path: taskYahlRelativePath(taskId),
    ...(runInputKeys ? { runInputKeys } : {}),
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
