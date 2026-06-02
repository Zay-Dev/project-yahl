import type { LiveEvent, LiveProvider } from "@refinedev/core";

import type { TResponseSessionListItem } from "@project-yahl/server/modules/sessions/-api-types";

import { connectSessionsStream } from "@/lib/sse";
import { RESOURCES } from "@/providers/constants";
import {
  setSessionsSnapshot,
  setStreamStatus,
} from "@/providers/sessions-cache";

type TSubscription = {
  callback: (event: LiveEvent) => void;
  channel: string;
  noop?: boolean;
};

const subscriptions = new Set<TSubscription>();
let disconnectStream: (() => void) | null = null;

const sessionsChannel = `resources/${RESOURCES.sessions}`;

const isSessionsSubscription = (channel: string, resource?: string) => {
  return channel === sessionsChannel || resource === RESOURCES.sessions;
};

const publishSessionsUpdate = (sessions: TResponseSessionListItem[]) => {
  const event: LiveEvent = {
    channel: sessionsChannel,
    date: new Date(),
    payload: { sessions },
    type: "updated",
  };

  subscriptions.forEach((subscription) => {
    subscription.callback(event);
  });
};

const ensureStreamConnected = () => {
  if (disconnectStream) {
    return;
  }

  disconnectStream = connectSessionsStream({
    onError: () => {
      setStreamStatus("disconnected");
    },
    onSessions: (sessions) => {
      setSessionsSnapshot(sessions);
      publishSessionsUpdate(sessions);
    },
    onStatus: setStreamStatus,
  });
};

const teardownStreamIfIdle = () => {
  if (subscriptions.size > 0 || !disconnectStream) {
    return;
  }

  disconnectStream();
  disconnectStream = null;
};

export const liveProvider: LiveProvider = {
  publish: () => {},
  subscribe: ({ callback, channel, params }) => {
    if (!isSessionsSubscription(channel, params?.resource)) {
      return { callback, channel, noop: true };
    }

    ensureStreamConnected();

    const subscription: TSubscription = { callback, channel };
    subscriptions.add(subscription);

    return subscription;
  },
  unsubscribe: (subscription: TSubscription) => {
    if (subscription?.noop) {
      return;
    }

    subscriptions.delete(subscription);
    teardownStreamIfIdle();
  },
};
