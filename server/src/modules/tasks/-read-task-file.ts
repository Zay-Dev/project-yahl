import fs from 'fs/promises';

import {
  parseRunInputFieldsFromYahl,
  runInputKeysOf,
} from '@project-yahl/shared/yahl/run-input-keys';

import { parseTaskMetadata } from './-parse-task-metadata';
import { readTaskSkillsFromDisk } from './-read-task-skills';
import { taskYahlAbsolutePath, taskYahlRelativePath } from './-tasks-root';

export const readTaskFile = async (taskId: string) => {
  const yahlPath = taskYahlAbsolutePath(taskId);
  const yahl = await fs.readFile(yahlPath, 'utf8');
  const { background, browser, description, name } = parseTaskMetadata(yahl);
  const runInputFields = parseRunInputFieldsFromYahl(yahl);
  const runInputKeys = runInputKeysOf(runInputFields);
  const taskSkills = await readTaskSkillsFromDisk(taskId);

  return {
    background,
    browser,
    description,
    id: taskId,
    name,
    path: taskYahlRelativePath(taskId),
    ...(runInputFields ? { runInputFields } : {}),
    ...(runInputKeys ? { runInputKeys } : {}),
    taskId,
    taskSkills,
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
