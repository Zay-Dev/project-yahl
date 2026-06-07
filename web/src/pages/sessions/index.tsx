import type { TResponseSessionListItem } from "@project-yahl/server/modules/sessions/-api-types";

import { useList } from "@refinedev/core";
import { Link } from "react-router";

import { SessionDeleteDialog } from "@/pages/sessions/components/session-delete-dialog";
import { SessionTitle } from "@/pages/sessions/components/session-title";
import { RESOURCES } from "@/providers/constants";

export function SessionsPage() {
  const { result } = useList<TResponseSessionListItem>({
    pagination: { currentPage: 1, mode: "client", pageSize: 100 },
    queryOptions: {
      placeholderData: { data: [], total: 0 },
    },
    resource: RESOURCES.sessions,
  });

  const sessions = result.data ?? [];

  return (
    <div className="rounded-xl bg-muted/50 p-4">
      <p className="text-sm text-muted-foreground">Recent sessions from SSE stream</p>
      <div className="mt-4 overflow-hidden rounded-lg border">
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
            {sessions.map((session) => (
              <tr key={session.sessionId} className="border-t">
                <td className="p-3">
                  <Link
                    className="text-primary underline-offset-2 hover:underline"
                    to={`/sessions/${encodeURIComponent(session.sessionId)}`}
                  >
                    <SessionTitle
                      sessionId={session.sessionId}
                      taskId={session.taskId}
                    />
                  </Link>
                </td>
                <td className="p-3">{new Date(session.updatedAt).toLocaleString()}</td>
                <td className="p-3">{session.tokenTotals?.totalTokens || 0}</td>
                <td className="p-3">
                  <SessionDeleteDialog sessionId={session.sessionId} />
                </td>
              </tr>
            ))}
            {sessions.length === 0 ? (
              <tr>
                <td className="p-3 text-muted-foreground" colSpan={4}>
                  Waiting for sessions stream...
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
