import { useOne } from "@refinedev/core";
import { useParams } from "react-router";

import type { TSessionDetail } from "@/lib/types";

import { RESOURCES } from "@/providers/constants";

export function SessionDetailPage() {
  const { id } = useParams();

  const { query, result } = useOne<TSessionDetail>({
    id: id ?? "",
    queryOptions: {
      enabled: !!id,
    },
    resource: RESOURCES.sessions,
  });

  const session = result;
  const error = query.error;
  const isLoading = query.isLoading;

  if (!id) {
    return <div className="rounded-xl bg-muted/50 p-4">Missing session id.</div>;
  }

  return (
    <div className="rounded-xl bg-muted/50 p-4">
      <p className="text-sm text-muted-foreground">Session detail</p>
      <p className="mt-1 text-lg font-semibold">{id}</p>
      {isLoading ? <p className="mt-4 text-sm">Loading session...</p> : null}
      {error ? (
        <p className="mt-4 text-sm text-destructive">
          {error instanceof Error ? error.message : "Request failed"}
        </p>
      ) : null}
      {session ? (
        <pre className="mt-4 overflow-auto rounded-lg border bg-background p-3 text-xs">
          {JSON.stringify(session, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}
