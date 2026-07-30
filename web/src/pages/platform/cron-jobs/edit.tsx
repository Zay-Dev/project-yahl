import { useEffect, useState } from "react";

import { Link, useNavigate, useParams } from "react-router";

import { Button } from "@/components/ui/button";
import {
  CronJobForm,
  type TCronJobFormValues,
  toCreateCronJobBody,
} from "@/pages/platform/cron-job-form";
import { deleteCronJob, getCronJob, updateCronJob } from "@/pages/platform/lib/platform-api";

const toFormValues = (job: {
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

  if (loading) {
    return <p className="p-6 text-sm text-muted-foreground">Loading cron job…</p>;
  }

  if (!values) {
    return <p className="p-6 text-sm text-destructive">{error ?? "Cron job not found"}</p>;
  }

  const canSave = values.schedule.trim() && values.taskPath.trim();

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
        <Button disabled={!canSave || saving || deleting} onClick={() => void save()}>
          Save changes
        </Button>
        <Button
          disabled={saving || deleting}
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
