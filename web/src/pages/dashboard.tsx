import { useList } from "@refinedev/core";
import { useMemo } from "react";
import { Link } from "react-router";

import type { TResponseSessionListItem } from "@project-yahl/server/modules/sessions/-api-types";

import { useStreamStatus } from "@/hooks/use-stream-status";
import { RESOURCES } from "@/providers/constants";

export function DashboardPage() {
  const streamStatus = useStreamStatus();

  const { result } = useList<TResponseSessionListItem>({
    pagination: { currentPage: 1, mode: "client", pageSize: 100 },
    queryOptions: {
      placeholderData: { data: [], total: 0 },
    },
    resource: RESOURCES.sessions,
  });

  const sessions = result.data ?? [];

  const totalTokens = useMemo(() => {
    return sessions.reduce((sum, session) => {
      return sum + (session.tokenTotals?.totalTokens || 0);
    }, 0);
  }, [sessions]);

  const latestSession = sessions[0];

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="grid auto-rows-min gap-4 md:grid-cols-3">
        <div className="rounded-xl bg-muted/50 p-4">
          <p className="text-sm text-muted-foreground">Stream status</p>
          <p className="text-2xl font-semibold">{streamStatus}</p>
        </div>
        <div className="rounded-xl bg-muted/50 p-4">
          <p className="text-sm text-muted-foreground">Sessions tracked</p>
          <p className="text-2xl font-semibold">{sessions.length}</p>
        </div>
        <div className="rounded-xl bg-muted/50 p-4">
          <p className="text-sm text-muted-foreground">Total tokens</p>
          <p className="text-2xl font-semibold">{totalTokens}</p>
        </div>
      </div>
      <div className="rounded-xl bg-muted/50 p-4">
        <p className="text-sm text-muted-foreground">Most recently updated session</p>
        {latestSession ? (
          <div className="mt-2 flex items-center justify-between gap-4">
            <p className="font-medium">{latestSession.sessionId}</p>
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
