import { useCallback, useEffect, useState } from "react";

import { fetchSessionById, openSessionSse } from "@/api";
import type { SessionDetail, SessionMetaSse, SessionStepSse } from "@/types";

export const useSessionDetail = (sessionId: string | null) => {
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveMeta, setLiveMeta] = useState<SessionMetaSse | null>(null);
  const [liveSteps, setLiveSteps] = useState<SessionStepSse[]>([]);

  const refresh = useCallback(async () => {
    if (!sessionId) return null;

    setLoading(true);
    setError(null);

    try {
      const next = await fetchSessionById(sessionId);
      setDetail(next);
      return next;
    } catch (loadError) {
      setError(String(loadError));
      return null;
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    setDetail(null);
    setLiveMeta(null);
    setLiveSteps([]);
    if (!sessionId) return;
    void refresh();
  }, [sessionId, refresh]);

  useEffect(() => {
    if (!sessionId) return undefined;

    let dispose: () => void = () => {};

    dispose = openSessionSse(sessionId, {
      onMeta: (meta) => {
        setLiveMeta(meta);
        if (meta.finalizedAt) dispose();
      },
      onStep: (step) => {
        setLiveSteps((prev) => [...prev, step]);
      },
    });

    return () => {
      dispose();
    };
  }, [sessionId]);

  return {
    detail,
    error,
    liveMeta,
    liveSteps,
    loading,
    refresh,
    setDetail,
  };
};
