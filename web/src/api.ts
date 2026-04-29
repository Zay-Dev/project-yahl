import type { SessionDetail, SessionListItem } from "./types";

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
