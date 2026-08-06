import { useEffect, useState } from "react";

import { Link, useNavigate, useParams } from "react-router";

import { Button } from "@/components/ui/button";
import {
  CronJobForm,
  type TCronJobFormValues,
  toCreateCronJobBody,
} from "@/pages/platform/cron-job-form";
import { deleteCronJob, getCronJob, updateCronJob } from "@/pages/platform/lib/platform-api";
import { createRun } from "@/pages/tasks/lib/tasks-api";

const toFormValues = (job: {
  deleteAfterRun?: boolean;
  enabled: boolean;
  id: string;
  orgId?: string;
  orgUnitId?: string;
  runInput?: Record<string, string>;
  schedule: string;
  taskPath: string;
  timezone?: string;
  userId?: string;
}): TCronJobFormValues => ({
  deleteAfterRun: job.deleteAfterRun ?? false,
  enabled: job.enabled,
  id: job.id,
  orgId: job.orgId ?? "",
  orgUnitId: job.orgUnitId ?? "",
  runInput: job.runInput ?? {},
  schedule: job.schedule,
  taskPath: job.taskPath,
  timezone: job.timezone ?? "",
  userId: job.userId ?? "",
});

export function CronJobEditPage() {
  const navigate = useNavigate();
  const { jobId = "" } = useParams();
  const [values, setValues] = useState<TCronJobFormValues | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        setValues(toFormValues(await getCronJob(jobId)));
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load cron job");
      } finally {
        setLoading(false);
      }
    };

    if (jobId) {
      void load();
    }
  }, [jobId]);

  const save = async () => {
    if (!values) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const body = toCreateCronJobBody(values);

      await updateCronJob(jobId, {
        deleteAfterRun: body.deleteAfterRun,
        enabled: body.enabled,
        orgId: body.orgId,
        orgUnitId: body.orgUnitId,
        runInput: body.runInput ?? {},
        schedule: body.schedule,
        taskPath: body.taskPath,
        timezone: body.timezone,
        userId: body.userId,
      });
      navigate("/platform/cron-jobs");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save cron job");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete cron job "${jobId}"?`)) {
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      await deleteCronJob(jobId);
      navigate("/platform/cron-jobs");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete cron job");
    } finally {
      setDeleting(false);
    }
  };

  const run = async () => {
    if (!values?.taskPath.trim()) {
      return;
    }

    setRunning(true);
    setError(null);

    try {
      const body = toCreateCronJobBody(values);
      const result = await createRun(body.taskPath, body.runInput);

      navigate(`/sessions/${encodeURIComponent(result.sessionId)}`);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Failed to start run");
      setRunning(false);
    }
  };

  if (loading) {
    return <p className="p-6 text-sm text-muted-foreground">Loading cron job…</p>;
  }

  if (!values) {
    return <p className="p-6 text-sm text-destructive">{error ?? "Cron job not found"}</p>;
  }

  const canSave = values.schedule.trim() && values.taskPath.trim();
  const busy = saving || deleting || running;

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">Edit cron job</h1>
        <Button render={<Link to="/platform/cron-jobs" />} size="sm" variant="outline">
          Back to cron jobs
        </Button>
      </div>

      <CronJobForm idReadOnly onChange={setValues} values={values} />

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex gap-2">
        <Button disabled={!canSave || busy} onClick={() => void save()}>
          Save changes
        </Button>
        <Button
          disabled={!values.taskPath.trim() || busy}
          onClick={() => void run()}
          size="sm"
          variant="outline"
        >
          Run
        </Button>
        <Button
          disabled={busy}
          onClick={() => void remove()}
          size="sm"
          variant="outline"
        >
          Delete
        </Button>
      </div>
    </div>
  );
}
