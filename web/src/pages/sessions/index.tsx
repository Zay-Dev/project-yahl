import type { TResponseSessionListItem } from "@project-yahl/server/modules/sessions/-api-types";

import { useList } from "@refinedev/core";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";

import { PendingQuestionsPanel } from "@/pages/sessions/components/pending-questions-panel";
import { SessionDeleteDialog } from "@/pages/sessions/components/session-delete-dialog";
import { SessionTitle } from "@/pages/sessions/components/session-title";
import {
  countHiddenBackgroundSessions,
  filterSessionsForList,
  readShowBackgroundSessions,
  writeShowBackgroundSessions,
} from "@/pages/sessions/lib/filter-sessions";
import { RESOURCES } from "@/providers/constants";

export function SessionsPage() {
  const [showBackground, setShowBackground] = useState(readShowBackgroundSessions);
  const { result } = useList<TResponseSessionListItem>({
    pagination: { currentPage: 1, mode: "client", pageSize: 100 },
    queryOptions: {
      placeholderData: { data: [], total: 0 },
    },
    resource: RESOURCES.sessions,
  });

  useEffect(() => {
    writeShowBackgroundSessions(showBackground);
  }, [showBackground]);

  const sessions = result.data ?? [];
  const visibleSessions = useMemo(
    () => filterSessionsForList(sessions, showBackground),
    [sessions, showBackground],
  );
  const hiddenBackgroundCount = useMemo(
    () => countHiddenBackgroundSessions(sessions, showBackground),
    [sessions, showBackground],
  );

  return (
    <div className="flex flex-col gap-6 rounded-xl bg-muted/50 p-4">
      <PendingQuestionsPanel compact />

      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">Recent sessions from SSE stream</p>
          <label className="flex items-center gap-2 text-sm">
            <input
              checked={showBackground}
              className="size-4 rounded border"
              onChange={(event) => setShowBackground(event.target.checked)}
              type="checkbox"
            />
            Show background sessions
          </label>
        </div>

        {hiddenBackgroundCount > 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {hiddenBackgroundCount} background session{hiddenBackgroundCount === 1 ? "" : "s"} hidden
          </p>
        ) : null}

        <div className="mt-4 overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-3 text-left font-medium">Task</th>
                <th className="p-3 text-left font-medium">Updated At</th>
                <th className="p-3 text-left font-medium">Tokens</th>
                <th className="p-3 text-left font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleSessions.map((session) => (
                <tr key={session.sessionId} className="border-t">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <Link
                        className="text-primary underline-offset-2 hover:underline"
                        to={`/sessions/${encodeURIComponent(session.sessionId)}`}
                      >
                        <SessionTitle
                          sessionId={session.sessionId}
                          taskId={session.taskId}
                        />
                      </Link>
                      {session.isBackground ? (
                        <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                          Background
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="p-3">{new Date(session.updatedAt).toLocaleString()}</td>
                  <td className="p-3">{session.tokenTotals?.totalTokens || 0}</td>
                  <td className="p-3">
                    <SessionDeleteDialog sessionId={session.sessionId} />
                  </td>
                </tr>
              ))}
              {visibleSessions.length === 0 ? (
                <tr>
                  <td className="p-3 text-muted-foreground" colSpan={4}>
                    {sessions.length === 0 ? "Waiting for sessions stream..." : "No sessions match the current filter."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
