import type {
  TResponseGetSession,
  TResponseModelUsageByModel,
  TResponseUserPauseCheckpoint,
} from "@project-yahl/server/modules/sessions/-api-types";

import { Link } from "react-router";

import { SessionTitle } from "@/pages/sessions/components/session-title";
import { TokenStatsRow } from "@/pages/sessions/components/token-stats-row";
import { SessionDeleteDialog } from "@/pages/sessions/components/session-delete-dialog";
import { SessionLiveViewMenu } from "@/pages/sessions/components/session-live-view-menu";
import { SessionTransportControls } from "@/pages/sessions/components/session-transport-controls";

type TSessionOverviewProps = {
  onActionComplete?: () => void;
  onPausePendingChange?: (pending: boolean) => void;
  onResumePendingChange?: (pending: boolean) => void;
  pausePending?: boolean;
  pauseWaitError?: string | null;
  pendingUserPause?: TResponseUserPauseCheckpoint | null;
  resumePending?: boolean;
  resumeWaitError?: string | null;
  session: TResponseGetSession;
  verifyAutoRetry?: boolean;
};

const formatDate = (value: string | undefined) => {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleString();
};

const UsageGroup = ({
  byModel,
  defId,
  domains,
  label,
  totals,
}: {
  byModel?: TResponseModelUsageByModel[];
  defId?: string;
  domains?: string[];
  label: string;
  totals: TResponseGetSession["tokenTotals"];
}) => {
  if (!totals && (!domains || domains.length === 0) && (!byModel || byModel.length === 0)) {
    return null;
  }

  return (
    <div className="rounded-lg border bg-background p-3">
      <p className="text-sm font-medium">{label}</p>
      {defId ? (
        <p className="mt-0.5 font-mono text-xs text-muted-foreground">{defId}</p>
      ) : null}
      <div className="mt-2">
        <TokenStatsRow
          byModel={byModel}
          compact={false}
          domains={domains}
          totals={totals}
        />
      </div>
    </div>
  );
};

export function SessionOverview({
  onActionComplete,
  onPausePendingChange,
  onResumePendingChange,
  pausePending = false,
  pauseWaitError = null,
  pendingUserPause = null,
  resumePending = false,
  resumeWaitError = null,
  session,
  verifyAutoRetry = false,
}: TSessionOverviewProps) {
  const totals = session.tokenTotals;
  const domains = session.domains;
  const stageUsage = session.stageUsage;
  const nixeryGroups = (session.nixeryUsage ?? []).filter(
    (group) => group.tokenTotals || group.domains.length > 0 || group.byModel.length > 0,
  );
  const hasUsage = Boolean(
    totals
    || stageUsage?.tokenTotals
    || nixeryGroups.length > 0
    || domains.length > 0
    || (session.byModel ?? []).length > 0,
  );

  return (
    <div className="rounded-xl bg-muted/50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Session overview</p>
          <SessionTitle
            className="mt-1"
            sessionId={session.sessionId}
            taskId={session.taskId}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SessionTransportControls
            onActionComplete={() => onActionComplete?.()}
            onPausePendingChange={(pending) => onPausePendingChange?.(pending)}
            onResumePendingChange={(pending) => onResumePendingChange?.(pending)}
            pausePending={pausePending}
            pauseWaitError={pauseWaitError}
            pendingUserPause={pendingUserPause}
            resumePending={resumePending}
            resumeWaitError={resumeWaitError}
            session={session}
            verifyAutoRetry={verifyAutoRetry}
          />
          {typeof session.liveViewVncPort === 'number' && session.liveViewVncPort > 0 ? (
            <SessionLiveViewMenu port={session.liveViewVncPort} />
          ) : null}
          <SessionDeleteDialog
            deletedAt={session.deletedAt}
            navigateAfterDelete
            sessionId={session.sessionId}
          />
          <Link
            className="text-sm text-primary underline-offset-2 hover:underline"
            to="/sessions"
          >
            Back to sessions
          </Link>
        </div>
      </div>
      <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Status</dt>
          <dd className="mt-0.5 font-medium">
            {session.deletedAt
              ? "Deleted"
              : session.runState === "active"
                ? "Running"
                : session.runState === "stuck"
                  ? "Stuck"
                  : "Idle"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Created</dt>
          <dd className="mt-0.5">{formatDate(session.createdAt)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Updated</dt>
          <dd className="mt-0.5">{formatDate(session.updatedAt)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Last Response</dt>
          <dd className="mt-0.5">{formatDate(session.lastModelResponseAt)}</dd>
        </div>
      </dl>
      {hasUsage ? (
        <div className="mt-4 space-y-3">
          <UsageGroup
            byModel={session.byModel}
            domains={domains}
            label="All"
            totals={totals}
          />
          <UsageGroup
            byModel={stageUsage?.byModel}
            domains={stageUsage?.domains}
            label="Stages"
            totals={stageUsage?.tokenTotals ?? null}
          />
          {nixeryGroups.map((group) => (
            <UsageGroup
              byModel={group.byModel}
              defId={group.defId}
              domains={group.domains}
              key={group.defId}
              label={group.defId.replaceAll("-", " ")}
              totals={group.tokenTotals}
            />
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">No token usage recorded yet.</p>
      )}
    </div>
  );
}
