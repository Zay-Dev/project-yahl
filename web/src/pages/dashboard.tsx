import { useList } from "@refinedev/core";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";

import type { TResponseSessionListItem } from "@project-yahl/server/modules/sessions/-api-types";

import { useStreamStatus } from "@/hooks/use-stream-status";
import { SessionTitle } from "@/pages/sessions/components/session-title";
import { API_BASE_URL, RESOURCES } from "@/providers/constants";

const quotaUsedPercent = (remainingPercent: number) => {
  const used = Math.round((100 - remainingPercent) * 10) / 10;

  return Math.min(100, Math.max(0, used));
};

export function DashboardPage() {
  const streamStatus = useStreamStatus();
  const [remainingPercent, setRemainingPercent] = useState<number | null>(null);

  const { result } = useList<TResponseSessionListItem>({
    pagination: { currentPage: 1, mode: "client", pageSize: 100 },
    queryOptions: {
      placeholderData: { data: [], total: 0 },
    },
    resource: RESOURCES.sessions,
  });

  const sessions = result.data ?? [];
  const showTokenUsage = sessions.length === 0 || Object.hasOwn(sessions[0], "tokenTotals");

  const totalTokens = useMemo(() => {
    return sessions.reduce((sum, session) => {
      return sum + (session.tokenTotals?.totalTokens || 0);
    }, 0);
  }, [sessions]);

  useEffect(() => {
    if (showTokenUsage) {
      return;
    }

    let cancelled = false;

    fetch(`${API_BASE_URL}/api/quota/status`)
      .then(async (response) => {
        if (!response.ok) {
          return null;
        }

        const json = await response.json() as {
          data?: { remainingPercent?: number | null };
          remainingPercent?: number | null;
        };
        const payload = json.data ?? json;

        return typeof payload.remainingPercent === "number" ? payload.remainingPercent : null;
      })
      .then((value) => {
        if (!cancelled) {
          setRemainingPercent(value);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRemainingPercent(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [showTokenUsage]);

  const usedPercent = remainingPercent == null ? null : quotaUsedPercent(remainingPercent);
  const latestSession = sessions[0];
  const showThirdCard = showTokenUsage || usedPercent !== null;

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className={`grid auto-rows-min gap-4 ${showThirdCard ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
        <div className="rounded-xl bg-muted/50 p-4">
          <p className="text-sm text-muted-foreground">Stream status</p>
          <p className="text-2xl font-semibold">{streamStatus}</p>
        </div>
        <div className="rounded-xl bg-muted/50 p-4">
          <p className="text-sm text-muted-foreground">Sessions tracked</p>
          <p className="text-2xl font-semibold">{sessions.length}</p>
        </div>
        {showTokenUsage ? (
          <div className="rounded-xl bg-muted/50 p-4">
            <p className="text-sm text-muted-foreground">Total tokens</p>
            <p className="text-2xl font-semibold">{totalTokens}</p>
          </div>
        ) : usedPercent !== null ? (
          <div className="rounded-xl bg-muted/50 p-4">
            <p className="text-sm text-muted-foreground">Quota used</p>
            <p className="text-2xl font-semibold">{usedPercent.toFixed(1)}%</p>
          </div>
        ) : null}
      </div>
      <div className="rounded-xl bg-muted/50 p-4">
        <p className="text-sm text-muted-foreground">Most recently updated session</p>
        {latestSession ? (
          <div className="mt-2 flex items-center justify-between gap-4">
            <SessionTitle
              sessionId={latestSession.sessionId}
              taskId={latestSession.taskId}
            />
            <Link
              className="text-sm text-primary underline-offset-2 hover:underline"
              to={`/sessions/${encodeURIComponent(latestSession.sessionId)}`}
            >
              Open detail
            </Link>
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">Waiting for sessions stream...</p>
        )}
      </div>
    </div>
  );
}
