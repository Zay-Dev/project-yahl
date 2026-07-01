import type { TResponseGetSession } from "@project-yahl/server/modules/sessions/-api-types";

type TSessionStuckBannerProps = {
  session: TResponseGetSession;
};

export function SessionStuckBanner({ session }: TSessionStuckBannerProps) {
  if (session.runState !== "stuck") {
    return null;
  }

  return (
    <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4">
      <p className="text-sm font-medium text-destructive">Run stopped unexpectedly</p>
      <p className="mt-1 text-sm text-muted-foreground">
        The orchestrator is no longer running, but at least one stage is still marked as in progress.
        Check the orchestrator log on the server or resume from the last verify checkpoint if one exists.
      </p>
    </div>
  );
}
