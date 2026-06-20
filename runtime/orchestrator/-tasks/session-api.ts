export type TTaskYahl = {
  description: string;
  name: string;
  path: string;
  taskId: string;
  yahl: string;
};

const sessionApiBaseUrl = () =>
  (process.env.SESSION_API_BASE_URL?.trim() || 'http://127.0.0.1:4000')
    .replace(/\/+$/, '');

export const fetchTaskYahl = async (taskId: string): Promise<TTaskYahl> => {
  const res = await fetch(
    `${sessionApiBaseUrl()}/api/tasks/${encodeURIComponent(taskId)}`,
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`task fetch failed: ${res.status} ${text}`);
  }

  const json = await res.json() as TTaskYahl & { data?: TTaskYahl };

  return json.data ?? json;
};
