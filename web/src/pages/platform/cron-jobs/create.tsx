import { useState } from "react";

import { Link, useNavigate } from "react-router";

import { Button } from "@/components/ui/button";
import {
  CronJobForm,
  EMPTY_CRON_JOB_FORM,
  toCreateCronJobBody,
} from "@/pages/platform/cron-job-form";
import { createCronJob } from "@/pages/platform/lib/platform-api";

export function CronJobCreatePage() {
  const navigate = useNavigate();
  const [values, setValues] = useState(EMPTY_CRON_JOB_FORM);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    setError(null);

    try {
      await createCronJob(toCreateCronJobBody(values));
      navigate("/platform/cron-jobs");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to create cron job");
    } finally {
      setSaving(false);
    }
  };

  const canSubmit = values.id.trim() && values.schedule.trim() && values.taskPath.trim();

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">New cron job</h1>
        <Button render={<Link to="/platform/cron-jobs" />} size="sm" variant="outline">
          Back to cron jobs
        </Button>
      </div>

      <CronJobForm onChange={setValues} values={values} />

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div>
        <Button disabled={!canSubmit || saving} onClick={() => void submit()}>
          Create cron job
        </Button>
      </div>
    </div>
  );
}
