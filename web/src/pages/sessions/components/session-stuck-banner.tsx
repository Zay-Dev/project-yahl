import type { TResponseGetSession } from "@project-yahl/server/modules/sessions/-api-types";

import { resolveSessionStuckCopy } from "@/pages/sessions/components/session-stuck-copy";

type TSessionStuckBannerProps = {
  session: TResponseGetSession;
};

export function SessionStuckBanner({ session }: TSessionStuckBannerProps) {
  if (session.runState !== "stuck") {
    return null;
  }

  const copy = resolveSessionStuckCopy(session);

  return (
    <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4">
      <p className="text-sm font-medium text-destructive">{copy.title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{copy.body}</p>
    </div>
  );
}
