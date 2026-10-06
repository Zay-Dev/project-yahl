import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useEnvOverrideStatus } from "@/hooks/use-env-override";
import { restartEnvOverrideServices } from "@/pages/platform/lib/platform-api";
import { CODE_SERVER_PUBLIC_URL } from "@/providers/constants";

export function EnvOverrideBanner() {
  const { status } = useEnvOverrideStatus();
  const [restarting, setRestarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!status?.pending && !restarting) {
    return null;
  }

  const onRestart = async (confirmRunning: boolean) => {
    setRestarting(true);
    setError(null);

    try {
      await restartEnvOverrideServices({ confirmRunning });
    } catch (err) {
      if (err instanceof Error && err.name === "EnvOverrideRunningTasks") {
        if (!window.confirm(`${err.message}. Restart worker and server?`)) {
          setRestarting(false);
          return;
        }

        await onRestart(true);
        return;
      }

      if (err instanceof TypeError) {
        setRestarting(false);
        return;
      }

      setRestarting(false);
      setError(err instanceof Error ? err.message : "Failed to restart");
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-900 dark:text-amber-100">
      <span>
        Override env changed — restart worker and server to apply.
        {" "}
        Edit
        {" "}
        <code className="text-xs">.env.override</code>
        {" "}
        in
        {" "}
        <a
          className="font-medium underline underline-offset-2"
          href={`${CODE_SERVER_PUBLIC_URL}/`}
          rel="noreferrer"
          target="_blank"
        >
          Knowledge / Files
        </a>
        .
      </span>
      <Button
        disabled={restarting}
        onClick={() => {
          void onRestart(false);
        }}
        size="sm"
        type="button"
        variant="outline"
      >
        {restarting ? "Restarting…" : "Restart services"}
      </Button>
      {error ? <span className="text-destructive">{error}</span> : null}
    </div>
  );
}
