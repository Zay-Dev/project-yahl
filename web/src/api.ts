import type {
  RerunRequestPayload,
  RuntimeRun,
  RuntimeRunLogEvent,
  RuntimeRunMetaSse,
  RuntimeRunStatusSse,
  RuntimeTask,
  SessionDetail,
  SessionListItem,
  SessionMetaSse,
  SessionsLifecycleSse,
  SessionStepSse,
} from "./types";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

export const fetchSessions = async () => {
  const response = await fetch(`${apiBaseUrl}/api/sessions?limit=100&offset=0`);
  if (!response.ok) throw new Error("Failed to fetch sessions");

  const data = await response.json() as { items: SessionListItem[] };
  return data.items;
};

export const fetchTasks = async () => {
  const response = await fetch(`${apiBaseUrl}/api/tasks`);
  if (!response.ok) throw new Error("Failed to fetch tasks");

  const data = await response.json() as { items: RuntimeTask[] };
  return data.items;
};

export const createRun = async (taskId: string) => {
  const response = await fetch(`${apiBaseUrl}/api/runs`, {
    body: JSON.stringify({ taskId }),
    headers: {
      "content-type": "application/json",
    },
    method: "POST",
  });
  if (!response.ok) throw new Error("Failed to create run");

  return await response.json() as RuntimeRun;
};

export const rerunRequest = async (payload: RerunRequestPayload) => {
  const response = await fetch(`${apiBaseUrl}/api/requests/rerun`, {
    body: JSON.stringify(payload),
    headers: {
      "content-type": "application/json",
    },
    method: "POST",
  });
  if (!response.ok) throw new Error("Failed to rerun request");

  return await response.json() as RuntimeRun;
};

export const fetchSessionById = async (sessionId: string) => {
  const response = await fetch(`${apiBaseUrl}/api/sessions/${sessionId}`);
  if (!response.ok) throw new Error("Failed to fetch session detail");

  return await response.json() as SessionDetail;
};

export const softDeleteSession = async (sessionId: string) => {
  const response = await fetch(`${apiBaseUrl}/api/sessions/${sessionId}/soft-delete`, {
    method: "POST",
  });
  if (!response.ok) throw new Error("Failed to soft delete session");
};

export const hardDeleteSession = async (sessionId: string) => {
  const response = await fetch(`${apiBaseUrl}/api/sessions/${sessionId}`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error("Failed to hard delete session");
};

export const openSessionSse = (
  sessionId: string,
  handlers: {
    onMeta: (meta: SessionMetaSse) => void;
    onStep: (step: SessionStepSse) => void;
  },
) => {
  const url = `${apiBaseUrl}/api/sessions/${encodeURIComponent(sessionId)}/stream`;
  const source = new EventSource(url);

  source.addEventListener("meta", (event) => {
    const message = event as MessageEvent<string>;

    try {
      handlers.onMeta(JSON.parse(message.data) as SessionMetaSse);
    } catch { }
  });

  source.addEventListener("step", (event) => {
    const message = event as MessageEvent<string>;

    try {
      handlers.onStep(JSON.parse(message.data) as SessionStepSse);
    } catch { }
  });

  return () => {
    source.close();
  };
};

export const openSessionsSse = (
  handlers: {
    onSession: (payload: SessionsLifecycleSse) => void;
  },
) => {
  const source = new EventSource(`${apiBaseUrl}/api/sessions/stream`);

  source.addEventListener("session", (event) => {
    const message = event as MessageEvent<string>;

    try {
      handlers.onSession(JSON.parse(message.data) as SessionsLifecycleSse);
    } catch { }
  });

  return () => {
    source.close();
  };
};

export const openRunLogsSse = (
  runId: string,
  handlers: {
    onLog: (payload: RuntimeRunLogEvent) => void;
    onMeta: (payload: RuntimeRunMetaSse) => void;
    onStatus: (payload: RuntimeRunStatusSse) => void;
  },
) => {
  const source = new EventSource(`${apiBaseUrl}/api/runs/${encodeURIComponent(runId)}/logs/stream`);

  source.addEventListener("meta", (event) => {
    const message = event as MessageEvent<string>;
    try {
      handlers.onMeta(JSON.parse(message.data) as RuntimeRunMetaSse);
    } catch { }
  });

  source.addEventListener("log", (event) => {
    const message = event as MessageEvent<string>;
    try {
      handlers.onLog(JSON.parse(message.data) as RuntimeRunLogEvent);
    } catch { }
  });

  source.addEventListener("status", (event) => {
    const message = event as MessageEvent<string>;
    try {
      handlers.onStatus(JSON.parse(message.data) as RuntimeRunStatusSse);
    } catch { }
  });

  return () => {
    source.close();
  };
};
