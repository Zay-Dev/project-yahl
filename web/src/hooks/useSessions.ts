import { useCallback, useEffect, useState } from "react";

import {
  fetchSessions,
  hardDeleteSession,
  openSessionsSse,
  softDeleteSession,
} from "@/api";
import type { SessionListItem } from "@/types";

export const useSessions = () => {
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const rows = await fetchSessions();
      setSessions(rows);
    } catch (loadError) {
      setError(String(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const dispose = openSessionsSse({
      onSession: () => {
        void refresh();
      },
    });

    return () => {
      dispose();
    };
  }, [refresh]);

  const softDelete = useCallback(async (sessionId: string) => {
    setError(null);
    try {
      await softDeleteSession(sessionId);
      await refresh();
    } catch (deleteError) {
      setError(String(deleteError));
    }
  }, [refresh]);

  const hardDelete = useCallback(async (sessionId: string) => {
    setError(null);
    try {
      await hardDeleteSession(sessionId);
      await refresh();
    } catch (deleteError) {
      setError(String(deleteError));
    }
  }, [refresh]);

  return {
    error,
    hardDelete,
    loading,
    refresh,
    sessions,
    softDelete,
  };
};
