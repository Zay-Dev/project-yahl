import fs from 'fs';
import path from 'path';

import {
  parseYahlTask,
  type TParseYahlTaskOptions,
} from '@project-yahl/shared/yahl/parse-task';

import { taskYahlAbsolutePath } from '../tasks/-tasks-root';

export const buildParseYahlTaskOptions = (params: {
  taskId?: string;
  taskYahlRefs?: Record<string, string>;
}): TParseYahlTaskOptions | undefined => {
  if (!params.taskId) {
    return undefined;
  }

  const taskRoot = path.dirname(taskYahlAbsolutePath(params.taskId));
  const refs = params.taskYahlRefs;

  if (!refs || !Object.keys(refs).length) {
    return { taskRoot };
  }

  return {
    taskRoot,
    readFile: (absolutePath: string) => {
      const relative = path.relative(taskRoot, absolutePath).split(path.sep).join('/');

      if (relative && !relative.startsWith('..') && relative in refs) {
        return refs[relative]!;
      }

      return fs.readFileSync(absolutePath, 'utf8');
    },
  };
};

export const parseSessionYahlTask = (
  taskYahl: string,
  params: {
    taskId?: string;
    taskYahlRefs?: Record<string, string>;
  },
) => parseYahlTask(taskYahl, buildParseYahlTaskOptions(params));
