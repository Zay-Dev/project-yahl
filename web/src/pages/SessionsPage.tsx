import { RefreshCcw } from "lucide-react";

import { SessionsTable } from "@/components/session/SessionsTable";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useSessions } from "@/hooks/useSessions";

export const SessionsPage = () => {
  const { error, hardDelete, loading, refresh, sessions, softDelete } = useSessions();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div className="space-y-1.5">
          <CardTitle>Backstage sessions</CardTitle>
          <CardDescription>
            Runtime sessions and debug traces. Click a row to inspect details.
          </CardDescription>
        </div>

        <Button onClick={() => void refresh()} size="sm" variant="outline">
          <RefreshCcw />
          Refresh
        </Button>
      </CardHeader>

      <CardContent>
        {error ? (
          <p className="mb-3 text-sm text-red-500">{error}</p>
        ) : null}

        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : sessions.length ? (
          <SessionsTable
            onHardDelete={hardDelete}
            onSoftDelete={softDelete}
            sessions={sessions}
          />
        ) : (
          <p className="rounded-md border border-dashed p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            No sessions yet. Start a run from the Runner page.
          </p>
        )}
      </CardContent>
    </Card>
  );
};
