import type { TResponseCronJobListItem } from "@project-yahl/server/modules/platform/-api-types";

import { useEffect, useState } from "react";

import { Link, useNavigate } from "react-router";

import { Button } from "@/components/ui/button";
import { deleteCronJob, listCronJobs } from "@/pages/platform/lib/platform-api";
import { createRun } from "@/pages/tasks/lib/tasks-api";

export function CronJobsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<TResponseCronJobListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);

    try {
      setItems(await listCronJobs());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load cron jobs");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const remove = async (id: string) => {
    if (!window.confirm(`Delete cron job "${id}"?`)) {
      return;
    }

    setDeletingId(id);
    setError(null);

    try {
      await deleteCronJob(id);
      await load();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete cron job");
    } finally {
      setDeletingId(null);
    }
  };

  const run = async (item: TResponseCronJobListItem) => {
    setRunningId(item.id);
    setError(null);

    try {
      const result = await createRun(item.taskPath, item.runInput);

      navigate(`/sessions/${encodeURIComponent(result.sessionId)}`);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Failed to start run");
      setRunningId(null);
    }
  };

  if (loading) {
    return <p className="p-6 text-sm text-muted-foreground">Loading cron jobs…</p>;
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Cron jobs</h1>
          <p className="text-sm text-muted-foreground">
            Scheduled tasks polled by the worker from platform cron definitions.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => void load()} size="sm" variant="outline">
            Refresh
          </Button>
          <Button render={<Link to="/platform/cron-jobs/new" />} size="sm">
            New cron job
          </Button>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}

      {items.length === 0 ? (
        <p className="text-sm">No cron jobs configured.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="min-w-[640px] w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-3 text-left font-medium">ID</th>
                <th className="p-3 text-left font-medium">Schedule</th>
                <th className="p-3 text-left font-medium">Task</th>
                <th className="p-3 text-left font-medium">Enabled</th>
                <th className="p-3 text-left font-medium">One-off</th>
                <th className="p-3 text-left font-medium">Timezone</th>
                <th className="p-3 text-left font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr className="border-t" key={item.id}>
                  <td className="p-3 font-medium">{item.id}</td>
                  <td className="p-3 font-mono text-xs">{item.schedule}</td>
                  <td className="p-3">{item.taskPath}</td>
                  <td className="p-3">{item.enabled ? "Yes" : "No"}</td>
                  <td className="p-3">{item.deleteAfterRun ? "Yes" : "No"}</td>
                  <td className="p-3">{item.timezone ?? "—"}</td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <Button
                        disabled={runningId === item.id || deletingId === item.id}
                        onClick={() => void run(item)}
                        size="sm"
                        variant="outline"
                      >
                        Run
                      </Button>
                      <Button
                        render={<Link to={`/platform/cron-jobs/${encodeURIComponent(item.id)}`} />}
                        size="sm"
                        variant="outline"
                      >
                        Edit
                      </Button>
                      <Button
                        disabled={deletingId === item.id || runningId === item.id}
                        onClick={() => void remove(item.id)}
                        size="sm"
                        variant="outline"
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
