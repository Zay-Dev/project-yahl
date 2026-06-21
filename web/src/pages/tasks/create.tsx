import { useState } from "react";

import { Link, useNavigate } from "react-router";

import { Button } from "@/components/ui/button";
import { createTask, DEFAULT_TASK_YAHL } from "@/pages/tasks/lib/tasks-api";

export function TaskCreatePage() {
  const navigate = useNavigate();
  const [taskId, setTaskId] = useState("");
  const [yahl, setYahl] = useState(DEFAULT_TASK_YAHL);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    setError(null);

    try {
      await createTask({ taskId: taskId.trim(), yahl });
      navigate(`/tasks/${encodeURIComponent(taskId.trim())}`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to create task");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl bg-muted/50 p-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-lg font-semibold">New task</h1>
        <Button asChild size="sm" variant="outline">
          <Link to="/tasks">Back to tasks</Link>
        </Button>
      </div>

      <label className="flex flex-col gap-2 text-sm">
        <span className="font-medium">Task id</span>
        <input
          className="rounded-md border bg-background px-3 py-2"
          onChange={(event) => setTaskId(event.target.value)}
          placeholder="my_task"
          value={taskId}
        />
      </label>

      <label className="flex flex-col gap-2 text-sm">
        <span className="font-medium">SKILL.yahl</span>
        <textarea
          className="min-h-[420px] rounded-md border bg-background px-3 py-2 font-mono text-xs"
          onChange={(event) => setYahl(event.target.value)}
          value={yahl}
        />
      </label>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div>
        <Button disabled={!taskId.trim() || saving} onClick={() => void submit()}>
          Create task
        </Button>
      </div>
    </div>
  );
}
