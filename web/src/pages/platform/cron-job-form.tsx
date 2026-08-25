import type { TRequestCreateCronJobBody } from "@project-yahl/server/modules/platform/-api-types";
import type { TRunInputField } from "@project-yahl/server/modules/tasks/-api-types";

import { useEffect, useState } from "react";

import { Input } from "@/components/ui/input";
import {
  composeCronExpression,
  describeCronExpression,
  EMPTY_CRON_SCHEDULE_UI,
  parseCronExpression,
  type TCronPreset,
  type TCronScheduleUi,
} from "@/pages/platform/lib/cron-schedule";
import {
  initialRunInputValues,
  RunInputFieldsForm,
} from "@/pages/tasks/components/run-input-fields";
import { getTask, listTasks } from "@/pages/tasks/lib/tasks-api";

export type TCronJobFormValues = {
  deleteAfterRun: boolean;
  enabled: boolean;
  id: string;
  orgId: string;
  orgUnitId: string;
  runInput: Record<string, string>;
  schedule: string;
  taskPath: string;
  timezone: string;
  userId: string;
};

export const EMPTY_CRON_JOB_FORM: TCronJobFormValues = {
  deleteAfterRun: false,
  enabled: true,
  id: "",
  orgId: "",
  orgUnitId: "",
  runInput: {},
  schedule: "0 8 * * *",
  taskPath: "",
  timezone: "",
  userId: "",
};

type TCronJobFormProps = {
  idReadOnly?: boolean;
  onChange: (values: TCronJobFormValues) => void;
  values: TCronJobFormValues;
};

export const toCreateCronJobBody = (values: TCronJobFormValues): TRequestCreateCronJobBody => {
  const runInputEntries = Object.entries(values.runInput)
    .map(([key, value]) => [key, value.trim()] as const)
    .filter(([, value]) => value.length > 0);
  const runInput = runInputEntries.length > 0
    ? Object.fromEntries(runInputEntries)
    : undefined;

  return {
    deleteAfterRun: values.deleteAfterRun,
    enabled: values.enabled,
    id: values.id.trim(),
    orgId: values.orgId.trim() || undefined,
    orgUnitId: values.orgUnitId.trim() || undefined,
    runInput,
    schedule: values.schedule.trim(),
    taskPath: values.taskPath.trim(),
    timezone: values.timezone.trim() || undefined,
    userId: values.userId.trim() || undefined,
  };
};

export function CronJobForm({ idReadOnly = false, onChange, values }: TCronJobFormProps) {
  const [tasks, setTasks] = useState<{
    name: string;
    runInputFields?: TRunInputField[];
    taskId: string;
  }[]>([]);
  const [tasksError, setTasksError] = useState<string | null>(null);
  const [runInputFields, setRunInputFields] = useState<TRunInputField[]>([]);
  const [runInputFieldsReady, setRunInputFieldsReady] = useState(false);
  const [scheduleUi, setScheduleUi] = useState<TCronScheduleUi>(() =>
    parseCronExpression(values.schedule || EMPTY_CRON_SCHEDULE_UI.raw),
  );

  useEffect(() => {
    const load = async () => {
      try {
        const items = await listTasks();

        setTasks(items.map((task) => ({
          name: task.name || task.taskId,
          runInputFields: task.runInputFields
            ?? (task.runInputKeys ?? []).map((key: string) => ({ key, type: "text" as const })),
          taskId: task.taskId,
        })));
      } catch (loadError) {
        setTasksError(loadError instanceof Error ? loadError.message : "Failed to load tasks");
      }
    };

    void load();
  }, []);

  useEffect(() => {
    setScheduleUi(parseCronExpression(values.schedule || EMPTY_CRON_SCHEDULE_UI.raw));
  }, [values.schedule]);

  useEffect(() => {
    const loadFields = async () => {
      if (!values.taskPath.trim()) {
        setRunInputFields([]);
        setRunInputFieldsReady(true);
        return;
      }

      setRunInputFieldsReady(false);

      const listed = tasks.find((task) => task.taskId === values.taskPath);

      if (listed) {
        setRunInputFields(listed.runInputFields ?? []);
        setRunInputFieldsReady(true);
        return;
      }

      if (tasks.length === 0) {
        return;
      }

      try {
        const task = await getTask(values.taskPath);
        const fields = task.runInputFields
          ?? (task.runInputKeys ?? []).map((key: string) => ({ key, type: "text" as const }));

        setRunInputFields(fields);
      } catch {
        setRunInputFields([]);
      } finally {
        setRunInputFieldsReady(true);
      }
    };

    void loadFields();
  }, [tasks, values.taskPath]);

  useEffect(() => {
    if (!runInputFieldsReady) {
      return;
    }

    onChange({
      ...values,
      runInput: initialRunInputValues(runInputFields, values.runInput),
    });
    // Sync runInput shape when task fields are ready / change only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runInputFields.map((field) => field.key).join("|"), runInputFieldsReady, values.taskPath]);

  const setField = <K extends keyof TCronJobFormValues>(key: K, value: TCronJobFormValues[K]) => {
    onChange({ ...values, [key]: value });
  };

  const applyScheduleUi = (nextUi: TCronScheduleUi) => {
    const expression = composeCronExpression(nextUi);

    setScheduleUi({ ...nextUi, raw: nextUi.preset === "custom" ? nextUi.raw : expression });
    setField("schedule", nextUi.preset === "custom" ? nextUi.raw : expression);
  };

  const setPreset = (preset: TCronPreset) => {
    applyScheduleUi({ ...scheduleUi, preset });
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

      <div className="flex flex-col gap-2 text-sm">
        <span className="font-medium">Schedule</span>
        <select
          className="h-8 w-full rounded-2xl border border-transparent bg-input/50 px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
          onChange={(event) => setPreset(event.target.value as TCronPreset)}
          value={scheduleUi.preset}
        >
          <option value="daily">Every day</option>
          <option value="weekday">Every weekday</option>
          <option value="hourly">Every hour</option>
          <option value="every_n_minutes">Every N minutes</option>
          <option value="custom">Custom (cron)</option>
        </select>

        {scheduleUi.preset === "daily" || scheduleUi.preset === "weekday" ? (
          <div className="flex gap-2">
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-xs text-muted-foreground">Hour (0–23)</span>
              <Input
                onChange={(event) => applyScheduleUi({ ...scheduleUi, hour: event.target.value })}
                type="number"
                value={scheduleUi.hour}
              />
            </label>
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-xs text-muted-foreground">Minute (0–59)</span>
              <Input
                onChange={(event) => applyScheduleUi({ ...scheduleUi, minute: event.target.value })}
                type="number"
                value={scheduleUi.minute}
              />
            </label>
          </div>
        ) : null}

        {scheduleUi.preset === "hourly" ? (
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Minute (0–59)</span>
            <Input
              onChange={(event) => applyScheduleUi({ ...scheduleUi, minute: event.target.value })}
              type="number"
              value={scheduleUi.minute}
            />
          </label>
        ) : null}

        {scheduleUi.preset === "every_n_minutes" ? (
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Every N minutes (1–59)</span>
            <Input
              onChange={(event) => applyScheduleUi({ ...scheduleUi, nMinutes: event.target.value })}
              type="number"
              value={scheduleUi.nMinutes}
            />
          </label>
        ) : null}

        {scheduleUi.preset === "custom" ? (
          <Input
            className="font-mono text-xs"
            onChange={(event) => applyScheduleUi({ ...scheduleUi, raw: event.target.value })}
            placeholder="0 8 * * *"
            value={scheduleUi.raw}
          />
        ) : (
          <p className="font-mono text-xs text-muted-foreground">{values.schedule}</p>
        )}

        <p className="text-xs text-muted-foreground">
          {describeCronExpression(values.schedule, scheduleUi)}
        </p>
      </div>

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

      <RunInputFieldsForm
        fields={runInputFields}
        onChange={(runInput) => setField("runInput", runInput)}
        title="Task run input"
        values={values.runInput}
      />

      <label className="flex items-center gap-2 text-sm">
        <input
          checked={values.enabled}
          className="size-4 rounded border"
          onChange={(event) => setField("enabled", event.target.checked)}
          type="checkbox"
        />
        <span className="font-medium">Enabled</span>
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          checked={values.deleteAfterRun}
          className="size-4 rounded border"
          onChange={(event) => setField("deleteAfterRun", event.target.checked)}
          type="checkbox"
        />
        <span className="font-medium">Run once and delete</span>
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
