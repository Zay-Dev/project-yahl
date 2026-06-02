import type { TSessionSummary } from "@/lib/types";

export type TStreamStatus = "connecting" | "connected" | "disconnected";

let sessionsSnapshot: TSessionSummary[] = [];
let streamStatus: TStreamStatus = "connecting";
const streamStatusListeners = new Set<() => void>();

export const getSessionsSnapshot = () => sessionsSnapshot;

export const setSessionsSnapshot = (sessions: TSessionSummary[]) => {
  sessionsSnapshot = sessions;
};

export const getStreamStatus = () => streamStatus;

export const setStreamStatus = (status: TStreamStatus) => {
  streamStatus = status;
  streamStatusListeners.forEach((listener) => listener());
};

export const subscribeStreamStatus = (listener: () => void) => {
  streamStatusListeners.add(listener);

  return () => {
    streamStatusListeners.delete(listener);
  };
};
