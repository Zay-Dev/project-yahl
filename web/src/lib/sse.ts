import type { TResponseSessionListItem, TResponseStageListItem, TSessionLiveEvent } from "@project-yahl/server/modules/sessions/-api-types";

import { API_BASE_URL } from "@/providers/constants";

type TUseSessionsStreamParams = {
  onError?: (error: Error) => void;
  onSessions: (sessions: TResponseSessionListItem[]) => void;
  onStatus?: (status: "connecting" | "connected" | "disconnected") => void;
};

type TUseSessionEventsStreamParams = {
  onError?: (error: Error) => void;
  onEvent: (event: TSessionLiveEvent) => void;
  onSnapshot: (stages: TResponseStageListItem[]) => void;
  onStatus?: (status: "connecting" | "connected" | "disconnected") => void;
  sessionId: string;
};

export const connectSessionsStream = ({
  onError,
  onSessions,
  onStatus,
}: TUseSessionsStreamParams) => {
  onStatus?.("connecting");
  const source = new EventSource(`${API_BASE_URL}/api/sessions`);

  const handleSessions = (event: MessageEvent) => {
    try {
      const parsed = JSON.parse(event.data) as TResponseSessionListItem[];
      onSessions(parsed);
      onStatus?.("connected");
    } catch (error) {
      const message = error instanceof Error ? error : new Error("Failed to parse SSE payload");
      onError?.(message);
    }
  };

  source.addEventListener("sessions", handleSessions);
  source.addEventListener("heartbeat", () => {
    onStatus?.("connected");
  });

  source.onerror = () => {
    onStatus?.("disconnected");
    onError?.(new Error("Disconnected from sessions stream"));
  };

  return () => {
    source.removeEventListener("sessions", handleSessions);
    source.close();
  };
};

export const connectSessionEventsStream = ({
  onError,
  onEvent,
  onSnapshot,
  onStatus,
  sessionId,
}: TUseSessionEventsStreamParams) => {
  onStatus?.("connecting");
  const url = `${API_BASE_URL}/api/sessions/${encodeURIComponent(sessionId)}/events/stream`;
  const source = new EventSource(url);

  const handleSnapshot = (event: MessageEvent) => {
    try {
      const parsed = JSON.parse(event.data) as { stages: TResponseStageListItem[] };
      onSnapshot(parsed.stages);
      onStatus?.("connected");
    } catch (error) {
      const message = error instanceof Error ? error : new Error("Failed to parse SSE snapshot");
      onError?.(message);
    }
  };

  const handleSessionEvent = (event: MessageEvent) => {
    try {
      const parsed = JSON.parse(event.data) as TSessionLiveEvent;
      onEvent(parsed);
      onStatus?.("connected");
    } catch (error) {
      const message = error instanceof Error ? error : new Error("Failed to parse SSE event");
      onError?.(message);
    }
  };

  source.addEventListener("snapshot", handleSnapshot);
  source.addEventListener("session-event", handleSessionEvent);
  source.addEventListener("heartbeat", () => {
    onStatus?.("connected");
  });

  source.onerror = () => {
    onStatus?.("disconnected");
    onError?.(new Error("Disconnected from session events stream"));
  };

  return () => {
    source.removeEventListener("snapshot", handleSnapshot);
    source.removeEventListener("session-event", handleSessionEvent);
    source.close();
  };
};
