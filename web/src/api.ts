import type {
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

export const fetchSessionById = async (sessionId: string) => {
  const response = await fetch(`${apiBaseUrl}/api/sessions/${sessionId}`);
  if (!response.ok) throw new Error("Failed to fetch session detail");

  return await response.json() as SessionDetail;
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
