import type {
  TResponseUserPauseCheckpoint,
  TSessionLiveEvent,
} from '@project-yahl/server/modules/sessions/-api-types';

import { useCallback, useEffect, useState } from 'react';

import { fetchPendingUserPauseCheckpoints } from '@/pages/sessions/lib/sessions-api';

const isUserPauseEvent = (event: TSessionLiveEvent | null) =>
  event?.type === 'user_pause.requested'
  || event?.type === 'user_pause.resumed'
  || event?.type === 'session.stopped'
  || event?.type === 'session.updated';

type TUseUserPauseCheckpointsParams = {
  lastEvent: TSessionLiveEvent | null;
  sessionId: string;
};

export const useUserPauseCheckpoints = ({
  lastEvent,
  sessionId,
}: TUseUserPauseCheckpointsParams) => {
  const [pendingCheckpoints, setPendingCheckpoints] = useState<TResponseUserPauseCheckpoint[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!sessionId) {
      return;
    }

    try {
      const items = await fetchPendingUserPauseCheckpoints(sessionId);
      setPendingCheckpoints(items);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load pause checkpoints');
    }
  }, [sessionId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  useEffect(() => {
    if (!isUserPauseEvent(lastEvent)) {
      return;
    }

    void refetch();
  }, [lastEvent, refetch]);

  return {
    error,
    pendingCheckpoint: pendingCheckpoints[0] ?? null,
    refetch,
  };
};
