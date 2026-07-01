import type { TResponseStageListItem, TSessionLiveEvent } from "@project-yahl/server/modules/sessions/-api-types";

import { useEffect, useRef, useState } from "react";

import { connectSessionEventsStream } from "@/lib/sse";
import { fetchSessionStages } from "@/pages/sessions/lib/sessions-api";

type TUseSessionEventsStreamParams = {
  onSessionUpdated?: () => void;
  sessionId: string;
};

const isStageListEvent = (event: TSessionLiveEvent) => {
  return event.type === 'stage.created'
    || event.type === 'stage.finished'
    || event.type === 'stage.verifying'
    || event.type === 'verify.passed'
    || event.type === 'stage.model-response'
    || event.type === 'stage.tool-call';
};

export const useSessionEventsStream = ({
  onSessionUpdated,
  sessionId,
}: TUseSessionEventsStreamParams) => {
  const [stages, setStages] = useState<TResponseStageListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastEvent, setLastEvent] = useState<TSessionLiveEvent | null>(null);
  const onSessionUpdatedRef = useRef(onSessionUpdated);

  onSessionUpdatedRef.current = onSessionUpdated;

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    let cancelled = false;

    const refetchStages = async () => {
      try {
        const items = await fetchSessionStages(sessionId);

        if (!cancelled) {
          setStages(items);
          setError(null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load stages");
        }
      }
    };

    const disconnect = connectSessionEventsStream({
      onError: (streamError) => {
        if (!cancelled) {
          setError(streamError.message);
        }
      },
      onRecovered: () => {
        if (!cancelled) {
          setError(null);
        }
      },
      onEvent: (event) => {
        if (cancelled) {
          return;
        }

        setLastEvent(event);

        if (event.type === 'session.updated') {
          onSessionUpdatedRef.current?.();
        }

        if (isStageListEvent(event)) {
          void refetchStages();
        }
      },
      onSnapshot: (snapshotStages) => {
        if (cancelled) {
          return;
        }

        setStages(snapshotStages);
        setIsLoading(false);
        setError(null);
      },
      sessionId,
    });

    return () => {
      cancelled = true;
      disconnect();
    };
  }, [sessionId]);

  return {
    error,
    isLoading,
    lastEvent,
    stages,
  };
};
