import type { TRunInputField } from "@project-yahl/server/modules/tasks/-api-types";

import { useEffect, useState } from "react";

import { Link, useNavigate, useParams } from "react-router";

import { Button } from "@/components/ui/button";
import {
  initialRunInputValues,
  RunInputFieldsForm,
} from "@/pages/tasks/components/run-input-fields";
import { createRun, getTask, updateTask } from "@/pages/tasks/lib/tasks-api";

export function TaskDetailPage() {
  const navigate = useNavigate();
  const { taskId = "" } = useParams();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [yahl, setYahl] = useState("");
  const [path, setPath] = useState("");
  const [runInputFields, setRunInputFields] = useState<TRunInputField[]>([]);
  const [runInputValues, setRunInputValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const task = await getTask(taskId);
        const fields = task.runInputFields
          ?? (task.runInputKeys ?? []).map((key: string) => ({ key, type: "text" as const }));

        setName(task.name);
        setDescription(task.description);
        setYahl(task.yahl);
        setPath(task.path);
        setRunInputFields(fields);
        setRunInputValues(initialRunInputValues(fields));
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load task");
      } finally {
        setLoading(false);
      }
    };

    if (taskId) {
      void load();
    }
  }, [taskId]);

  const save = async () => {
    setSaving(true);
    setError(null);

    try {
      await updateTask(taskId, yahl);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save task");
    } finally {
      setSaving(false);
    }
  };

  const run = async () => {
    const runInput = runInputFields.length > 0
      ? Object.fromEntries(
        runInputFields.map((field) => [field.key, runInputValues[field.key]?.trim() ?? ""]),
      )
      : undefined;
    const result = await createRun(taskId, runInput);

    navigate(`/sessions/${encodeURIComponent(result.sessionId)}`);
  };

  if (loading) {
    return <p className="p-4 text-sm text-muted-foreground">Loading task…</p>;
  }

  if (error && !yahl) {
    return <p className="p-4 text-sm text-destructive">{error}</p>;
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl bg-muted/50 p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">{name || taskId}</h1>
          <p className="text-sm text-muted-foreground">{description || "No description"}</p>
          <p className="text-xs text-muted-foreground">{path}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => void run()} size="sm">
            Run
          </Button>
          <Button render={<Link to="/tasks" />} size="sm" variant="outline">
            Back to tasks
          </Button>
        </div>
      </div>

      <RunInputFieldsForm
        fields={runInputFields}
        onChange={setRunInputValues}
        values={runInputValues}
      />

      <label className="flex flex-col gap-2 text-sm">
        <span className="font-medium">SKILL.yaml</span>
        <textarea
          className="min-h-[520px] rounded-md border bg-background px-3 py-2 font-mono text-xs"
          onChange={(event) => setYahl(event.target.value)}
          value={yahl}
        />
      </label>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div>
        <Button disabled={saving} onClick={() => void save()}>
          Save
        </Button>
      </div>
    </div>
  );
}
