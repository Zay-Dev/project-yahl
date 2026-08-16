import fs from 'fs';
import path from 'path';

export const TASK_YAHL_FILENAMES = ['SKILL.yaml', 'SKILL.yml'] as const;

export const TASK_YAHL_WRITE_FILENAME = TASK_YAHL_FILENAMES[0];

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

export const resolveTasksRoot = () =>
  path.join(_findProjectYahlRoot(process.cwd()), 'server', 'tasks');

export const resolveTaskYahlFilename = (taskId: string) => {
  const taskDir = path.join(resolveTasksRoot(), taskId);

  for (const filename of TASK_YAHL_FILENAMES) {
    if (fs.existsSync(path.join(taskDir, filename))) {
      return filename;
    }
  }

  return TASK_YAHL_WRITE_FILENAME;
};

export const taskYahlRelativePath = (taskId: string) =>
  `server/tasks/${taskId}/${resolveTaskYahlFilename(taskId)}`;

export const taskYahlAbsolutePath = (taskId: string) =>
  path.join(resolveTasksRoot(), taskId, resolveTaskYahlFilename(taskId));
