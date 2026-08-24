import type {
  TResponseGetSession,
  TResponseStageListItem,
  TResponseVerifyCheckpoint,
  TSessionLiveEvent,
} from '@project-yahl/server/modules/sessions/-api-types';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { fetchPendingVerifyCheckpoints } from '@/pages/sessions/lib/sessions-api';
import { resolveVerifyBannerState } from '@/pages/sessions/hooks/resolve-verify-banner';

const isVerifyCheckpointEvent = (event: TSessionLiveEvent | null) =>
  event?.type === 'verify.failed'
  || event?.type === 'produce_keys.failed'
  || event?.type === 'verify.passed'
  || event?.type === 'verify.resumed'
  || event?.type === 'produce_keys.resumed'
  || event?.type === 'session.stopped';

type TUseVerifyCheckpointsParams = {
  lastEvent: TSessionLiveEvent | null;
  session: Pick<TResponseGetSession, 'liveViewVncPort'> | null;
  sessionId: string;
  stages: TResponseStageListItem[];
};

export const useVerifyCheckpoints = ({
  lastEvent,
  session,
  sessionId,
  stages,
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

  const bannerState = useMemo(
    () => (session ? resolveVerifyBannerState(pendingCheckpoints, stages, session) : null),
    [pendingCheckpoints, session, stages],
  );

  return {
    bannerState,
    error,
    pendingCheckpoint: bannerState?.checkpoint ?? null,
    pendingCheckpoints,
    refetch,
  };
};
