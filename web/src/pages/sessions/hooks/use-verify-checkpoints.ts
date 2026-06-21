import type {
  TResponseVerifyCheckpoint,
  TSessionLiveEvent,
} from '@project-yahl/server/modules/sessions/-api-types';

import { useCallback, useEffect, useState } from 'react';

import { fetchPendingVerifyCheckpoints } from '@/pages/sessions/lib/sessions-api';

const isVerifyCheckpointEvent = (event: TSessionLiveEvent | null) =>
  event?.type === 'verify.failed'
  || event?.type === 'produce_keys.failed'
  || event?.type === 'verify.resumed'
  || event?.type === 'produce_keys.resumed';

type TUseVerifyCheckpointsParams = {
  lastEvent: TSessionLiveEvent | null;
  sessionId: string;
};

export const useVerifyCheckpoints = ({
  lastEvent,
  sessionId,
}: TUseVerifyCheckpointsParams) => {
  const [pendingCheckpoints, setPendingCheckpoints] = useState<TResponseVerifyCheckpoint[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!sessionId) {
      return;
    }

    try {
      const items = await fetchPendingVerifyCheckpoints(sessionId);
      setPendingCheckpoints(items);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load verify checkpoints');
    }
  }, [sessionId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  useEffect(() => {
    if (!isVerifyCheckpointEvent(lastEvent)) {
      return;
    }

    void refetch();
  }, [lastEvent, refetch]);

  return {
    error,
    pendingCheckpoint: pendingCheckpoints[0] ?? null,
    pendingCheckpoints,
    refetch,
  };
};
