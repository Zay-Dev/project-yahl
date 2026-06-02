import type { TResponseStageDetail, TResponseStageListItem } from "@project-yahl/server/modules/sessions/-api-types";

import { API_BASE_URL } from "@/providers/constants";

const base = API_BASE_URL.replace(/\/$/, "");

const parseJson = async <T,>(response: Response): Promise<T> => {
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(detail || `Request failed (${response.status})`);
  }

  return response.json() as Promise<T>;
};

export const fetchSessionStages = async (sessionId: string) => {
  const url = `${base}/api/sessions/${encodeURIComponent(sessionId)}/stages`;
  const response = await fetch(url);

  return parseJson<TResponseStageListItem[]>(response);
};

export const fetchSessionStageDetail = async (sessionId: string, requestId: string) => {
  const url = `${base}/api/sessions/${encodeURIComponent(sessionId)}` +
    `/stages/${encodeURIComponent(requestId)}`;
  const response = await fetch(url);

  return parseJson<TResponseStageDetail>(response);
};
