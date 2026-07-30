import { validateRunInputPayload } from '@project-yahl/shared/yahl/run-input-keys';

import { Repository } from '@/core';

import { readTaskFile, taskExists } from './-read-task-file';

Repository.registerValidateTaskRunInput(async (taskId, runInput) => {
  if (!(await taskExists(taskId))) {
    return { message: `Unknown task: ${taskId}`, ok: false };
  }

  const task = await readTaskFile(taskId);

  return validateRunInputPayload(runInput, task.runInputKeys);
});
