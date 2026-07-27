import { exposedRoute } from '@/servers';

import './-inject';
import { createRun } from './use-cases/create-run';
import { createTask } from './use-cases/create-task';
import { getTask } from './use-cases/get-task';
import { listTasks } from './use-cases/list-tasks';
import { updateTask } from './use-cases/update-task';

exposedRoute('/api/tasks')
  .get('/', listTasks)
  .post('/', createTask)
  .get('/:taskId', getTask)
  .put('/:taskId', updateTask);

exposedRoute('/api/runs')
  .post('/', createRun);
