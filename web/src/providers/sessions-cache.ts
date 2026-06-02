import type { TResponseSessionListItem } from "@project-yahl/server/modules/sessions/-api-types";

export type TStreamStatus = "connecting" | "connected" | "disconnected";

let sessionsSnapshot: TResponseSessionListItem[] = [];
let streamStatus: TStreamStatus = "connecting";
const streamStatusListeners = new Set<() => void>();

export const getSessionsSnapshot = () => sessionsSnapshot;

export const setSessionsSnapshot = (sessions: TResponseSessionListItem[]) => {
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
