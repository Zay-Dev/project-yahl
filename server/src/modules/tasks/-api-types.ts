export type TResponseTaskListItem = {
  background?: boolean;
  description: string;
  id: string;
  name: string;
  path: string;
  taskId: string;
};

export type TResponseTask = TResponseTaskListItem & {
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
