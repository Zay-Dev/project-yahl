import type {
  TResponseCreateRun,
  TResponseCreateTask,
  TResponseTask,
  TResponseTaskListItem,
  TResponseUpdateTask,
} from "@project-yahl/server/modules/tasks/-api-types";

import { API_BASE_URL } from "@/providers/constants";

const tasksBase = `${API_BASE_URL}/api/tasks`;
const runsBase = `${API_BASE_URL}/api/runs`;

const parseData = <T>(json: T & { data?: T }) => json.data ?? json;

export const listTasks = async () => {
  const res = await fetch(tasksBase);

  if (!res.ok) {
    throw new Error(`Failed to list tasks: ${res.status}`);
  }

  const json = await res.json() as { data?: TResponseTaskListItem[] };

  return Array.isArray(json) ? json : json.data ?? [];
};

export const getTask = async (taskId: string) => {
  const res = await fetch(`${tasksBase}/${encodeURIComponent(taskId)}`);

  if (!res.ok) {
    throw new Error(`Failed to load task: ${res.status}`);
  }

  const json = await res.json() as TResponseTask & { data?: TResponseTask };

  return parseData(json);
};

export const createTask = async (body: { taskId: string; yahl: string }) => {
  const res = await fetch(tasksBase, {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });

  if (!res.ok) {
    throw new Error(`Failed to create task: ${res.status}`);
  }

  const json = await res.json() as TResponseCreateTask & { data?: TResponseCreateTask };

  return parseData(json);
};

export const updateTask = async (taskId: string, yahl: string) => {
  const res = await fetch(`${tasksBase}/${encodeURIComponent(taskId)}`, {
    body: JSON.stringify({ yahl }),
    headers: { "Content-Type": "application/json" },
    method: "PUT",
  });

  if (!res.ok) {
    throw new Error(`Failed to update task: ${res.status}`);
  }

  const json = await res.json() as TResponseUpdateTask & { data?: TResponseUpdateTask };

  return parseData(json);
};

export const createRun = async (taskId: string) => {
  const res = await fetch(runsBase, {
    body: JSON.stringify({ taskId }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });

  if (!res.ok) {
    throw new Error(`Failed to start run: ${res.status}`);
  }

  const json = await res.json() as TResponseCreateRun & { data?: TResponseCreateRun };

  return parseData(json);
};

export const DEFAULT_TASK_YAHL = `name: New task
description: Describe what this task does

stages:
  - logic: |
      (() => ({ result: "hello" }))
`;
