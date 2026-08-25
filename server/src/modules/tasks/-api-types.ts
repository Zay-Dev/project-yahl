import type { TRunInputField } from '@project-yahl/shared/yahl/run-input-keys';
import type { TTaskSkillFile } from '@project-yahl/shared/yahl/task-skills';

export type { TRunInputField };

export type TResponseTaskListItem = {
  background?: boolean;
  description: string;
  id: string;
  name: string;
  path: string;
  runInputFields?: TRunInputField[];
  runInputKeys?: string[];
  taskId: string;
};

export type TResponseTask = TResponseTaskListItem & {
  taskSkills: TTaskSkillFile[];
  yahl: string;
};

export type TResponseCreateRun = {
  sessionId: string;
  taskId: string;
};

export type TResponseCreateTask = {
  ok: true;
  taskId: string;
};

export type TResponseUpdateTask = {
  ok: true;
  taskId: string;
};
