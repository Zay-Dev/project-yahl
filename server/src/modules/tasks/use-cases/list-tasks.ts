import fs from 'fs/promises';

import { parseRunInputKeysFromYahl } from '@project-yahl/shared/yahl/run-input-keys';

import { Middlewares } from '@omni-infra/express';

import type { TResponseTaskListItem } from '../-api-types';
import { parseTaskMetadata } from '../-parse-task-metadata';
import { resolveTasksRoot, taskYahlRelativePath } from '../-tasks-root';

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
        const yahlPath = `${tasksRoot}/${taskId}/SKILL.yahl`;

        try {
          const yahl = await fs.readFile(yahlPath, 'utf8');
          const { background, description, name } = parseTaskMetadata(yahl);
          const runInputKeys = parseRunInputKeysFromYahl(yahl);

          items.push({
            background,
            description,
            id: taskId,
            name,
            path: taskYahlRelativePath(taskId),
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
