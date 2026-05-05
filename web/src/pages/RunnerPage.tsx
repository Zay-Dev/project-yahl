import { Loader2, Play, RefreshCcw } from "lucide-react";
import { Link } from "react-router-dom";

import { useRunnerContext } from "@/app/RunnerContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { RuntimeRunStatusSse } from "@/types";

const statusVariant = (status: RuntimeRunStatusSse["status"] | undefined) => {
  if (status === "running") return "outline" as const;
  if (status === "completed") return "default" as const;
  return "secondary" as const;
};

export const RunnerPage = () => {
  const {
    error,
    refreshTasks,
    run,
    runLogs,
    runMeta,
    runStatus,
    selectedTaskId,
    setSelectedTaskId,
    startRun,
    tasks,
    tasksLoading,
  } = useRunnerContext();

  const onStart = async () => {
    await startRun();
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Runtime Runner</CardTitle>
          <CardDescription>Select a task, start the orchestrator, and watch the live logs.</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Select
              disabled={tasksLoading || !tasks.length}
              onValueChange={(value) => setSelectedTaskId(value)}
              value={selectedTaskId}
            >
              <SelectTrigger className="min-w-[260px]">
                <SelectValue placeholder={tasksLoading ? "Loading tasks..." : "Pick a task"} />
              </SelectTrigger>
              <SelectContent>
                {tasks.map((task) => (
                  <SelectItem key={task.id} value={task.id}>
                    {task.label || task.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              disabled={!selectedTaskId || tasksLoading}
              onClick={() => void onStart()}
              size="sm"
            >
              <Play />
              Start
            </Button>

            <Button onClick={() => void refreshTasks()} size="sm" variant="outline">
              <RefreshCcw />
              Refresh tasks
            </Button>

            {run ? (
              <Badge variant="outline">run: {run.runId.slice(0, 8)}</Badge>
            ) : null}

            {runMeta ? (
              <Button asChild size="sm" variant="secondary">
                <Link to={`/sessions/${runMeta.sessionId}`}>session: {runMeta.sessionId.slice(0, 8)}</Link>
              </Button>
            ) : null}

            {runStatus ? (
              <Badge variant={statusVariant(runStatus.status)}>
                {runStatus.status === "running" ? (
                  <Loader2 className="animate-spin" />
                ) : null}
                {runStatus.status}
              </Badge>
            ) : null}
          </div>

          {error ? (
            <p className="text-sm text-red-500">{error}</p>
          ) : null}

          <div>
            <p className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">Run logs</p>
            {runLogs.length ? (
              <pre className="whitespace-pre-wrap rounded-md border bg-slate-50 p-3 text-xs dark:bg-slate-900">
                {runLogs.map((entry) => 
                  <div key={entry.ts}
                    className="pl-7 -indent-7"
                  >
                    [{entry.ts}] {entry.line}
                  </div>
                )}
              </pre>
            ) : (
              <p className="rounded-md border border-dashed p-6 text-center text-sm text-slate-500 dark:text-slate-400">
                No run logs yet. Start a run to see live output.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
