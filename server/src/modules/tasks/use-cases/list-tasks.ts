import fs from 'fs/promises';

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
          const { description, name } = parseTaskMetadata(yahl);

          items.push({
            description,
            id: taskId,
            name,
            path: taskYahlRelativePath(taskId),
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
