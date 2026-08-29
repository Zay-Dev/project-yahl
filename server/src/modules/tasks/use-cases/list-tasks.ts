import fs from 'fs/promises';

import {
  parseRunInputFieldsFromYahl,
  runInputKeysOf,
} from '@project-yahl/shared/yahl/run-input-keys';

import { Middlewares } from '@omni-infra/express';

import type { TResponseTaskListItem } from '../-api-types';
import { parseTaskMetadata } from '../-parse-task-metadata';
import { resolveTasksRoot, taskYahlAbsolutePath, taskYahlRelativePath } from '../-tasks-root';

export const listTasks = [
  Middlewares.Chainable
    .next(async (express) => {
      const tasksRoot = resolveTasksRoot();
      const entries = await fs.readdir(tasksRoot, { withFileTypes: true });
      const items: TResponseTaskListItem[] = [];

      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue;
        }

        const taskId = entry.name;

        try {
          const yahl = await fs.readFile(taskYahlAbsolutePath(taskId), 'utf8');
          const { background, browser, description, name } = parseTaskMetadata(yahl);
          const runInputFields = parseRunInputFieldsFromYahl(yahl);
          const runInputKeys = runInputKeysOf(runInputFields);

          items.push({
            background,
            browser,
            description,
            id: taskId,
            name,
            path: taskYahlRelativePath(taskId),
            ...(runInputFields ? { runInputFields } : {}),
            ...(runInputKeys ? { runInputKeys } : {}),
            taskId,
          });
        } catch {
          continue;
        }
      }

      items.sort((left, right) => left.taskId.localeCompare(right.taskId));

      express.respondMany<TResponseTaskListItem>(items);
    })
    .toMiddleware(),
];
