import type { TResponseSessionListItem } from "@project-yahl/server/modules/sessions/-api-types";

import { API_BASE_URL } from "@/providers/constants";

type TUseSessionsStreamParams = {
  onError?: (error: Error) => void;
  onSessions: (sessions: TResponseSessionListItem[]) => void;
  onStatus?: (status: "connecting" | "connected" | "disconnected") => void;
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
