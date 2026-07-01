import type { TResponseSessionListItem } from "@project-yahl/server/modules/sessions/-api-types";

export const SHOW_BACKGROUND_SESSIONS_KEY = "yahl.sessions.showBackground";

export const readShowBackgroundSessions = () => {
  try {
    return localStorage.getItem(SHOW_BACKGROUND_SESSIONS_KEY) === "true";
  } catch {
    return false;
  }
};

export const writeShowBackgroundSessions = (show: boolean) => {
  try {
    localStorage.setItem(SHOW_BACKGROUND_SESSIONS_KEY, show ? "true" : "false");
  } catch {
    // ignore storage errors
  }
};

export const filterSessionsForList = (
  sessions: TResponseSessionListItem[],
  showBackground: boolean,
) => {
  if (showBackground) {
    return sessions;
  }

  return sessions.filter((session) => session.isBackground !== true);
};

export const countHiddenBackgroundSessions = (
  sessions: TResponseSessionListItem[],
  showBackground: boolean,
) => {
  if (showBackground) {
    return 0;
  }

  return sessions.filter((session) => session.isBackground === true).length;
};
