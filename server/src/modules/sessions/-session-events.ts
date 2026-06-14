import type { TSessionLiveEvent } from './-api-types';

type TSessionEventListener = (event: TSessionLiveEvent) => void;

const listenersBySessionId = new Map<string, Set<TSessionEventListener>>();

export const emitSessionEvent = (sessionId: string, event: TSessionLiveEvent) => {
  listenersBySessionId.get(sessionId)?.forEach((listener) => {
    listener(event);
  });
};

export const subscribeSessionEvents = (
  sessionId: string,
  listener: TSessionEventListener,
) => {
  const listeners = listenersBySessionId.get(sessionId) ?? new Set<TSessionEventListener>();

  listeners.add(listener);
  listenersBySessionId.set(sessionId, listeners);

  return () => {
    listeners.delete(listener);

    if (listeners.size === 0) {
      listenersBySessionId.delete(sessionId);
    }
  };
};
