import type { TRequestCreateCronJobBody } from "@project-yahl/server/modules/platform/-api-types";

import { useEffect, useState } from "react";

import { Input } from "@/components/ui/input";
import { listTasks } from "@/pages/tasks/lib/tasks-api";

export type TCronJobFormValues = {
  enabled: boolean;
  id: string;
  orgId: string;
  orgUnitId: string;
  schedule: string;
  taskPath: string;
  timezone: string;
  userId: string;
};

export const EMPTY_CRON_JOB_FORM: TCronJobFormValues = {
  enabled: true,
  id: "",
  orgId: "",
  orgUnitId: "",
  schedule: "",
  taskPath: "",
  timezone: "",
  userId: "",
};

type TCronJobFormProps = {
  idReadOnly?: boolean;
  onChange: (values: TCronJobFormValues) => void;
  values: TCronJobFormValues;
};

export const toCreateCronJobBody = (values: TCronJobFormValues): TRequestCreateCronJobBody => ({
  enabled: values.enabled,
  id: values.id.trim(),
  orgId: values.orgId.trim() || undefined,
  orgUnitId: values.orgUnitId.trim() || undefined,
  schedule: values.schedule.trim(),
  taskPath: values.taskPath.trim(),
  timezone: values.timezone.trim() || undefined,
  userId: values.userId.trim() || undefined,
});

export function CronJobForm({ idReadOnly = false, onChange, values }: TCronJobFormProps) {
  const [tasks, setTasks] = useState<{ taskId: string; name: string }[]>([]);
  const [tasksError, setTasksError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const items = await listTasks();

        setTasks(items.map((task) => ({
          name: task.name || task.taskId,
          taskId: task.taskId,
        })));
      } catch (loadError) {
        setTasksError(loadError instanceof Error ? loadError.message : "Failed to load tasks");
      }
    };

    void load();
  }, []);

  const setField = <K extends keyof TCronJobFormValues>(key: K, value: TCronJobFormValues[K]) => {
    onChange({ ...values, [key]: value });
  };

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-2 text-sm">
        <span className="font-medium">ID</span>
        <Input
          disabled={idReadOnly}
          onChange={(event) => setField("id", event.target.value)}
          placeholder="hk_weather_daily"
          readOnly={idReadOnly}
          value={values.id}
        />
      </label>

      <label className="flex flex-col gap-2 text-sm">
        <span className="font-medium">Schedule</span>
        <Input
          className="font-mono text-xs"
          onChange={(event) => setField("schedule", event.target.value)}
          placeholder="0 8 * * *"
          value={values.schedule}
        />
      </label>

      <label className="flex flex-col gap-2 text-sm">
        <span className="font-medium">Task</span>
        <select
          className="h-8 w-full rounded-2xl border border-transparent bg-input/50 px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
          onChange={(event) => setField("taskPath", event.target.value)}
          value={values.taskPath}
        >
          <option value="">Select a task</option>
          {tasks.map((task) => (
            <option key={task.taskId} value={task.taskId}>
              {task.name} ({task.taskId})
            </option>
          ))}
        </select>
        {tasksError ? <span className="text-xs text-destructive">{tasksError}</span> : null}
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          checked={values.enabled}
          className="size-4 rounded border"
          onChange={(event) => setField("enabled", event.target.checked)}
          type="checkbox"
        />
        <span className="font-medium">Enabled</span>
      </label>

      <label className="flex flex-col gap-2 text-sm">
        <span className="font-medium">Timezone</span>
        <Input
          onChange={(event) => setField("timezone", event.target.value)}
          placeholder="Asia/Hong_Kong"
          value={values.timezone}
        />
      </label>

      <label className="flex flex-col gap-2 text-sm">
        <span className="font-medium">Org ID</span>
        <Input
          onChange={(event) => setField("orgId", event.target.value)}
          value={values.orgId}
        />
      </label>

      <label className="flex flex-col gap-2 text-sm">
        <span className="font-medium">Org unit ID</span>
        <Input
          onChange={(event) => setField("orgUnitId", event.target.value)}
          value={values.orgUnitId}
        />
      </label>

      <label className="flex flex-col gap-2 text-sm">
        <span className="font-medium">User ID</span>
        <Input
          onChange={(event) => setField("userId", event.target.value)}
          value={values.userId}
        />
      </label>
    </div>
  );
}
