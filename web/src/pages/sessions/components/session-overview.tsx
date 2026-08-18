import type { TResponseGetSession } from "@project-yahl/server/modules/sessions/-api-types";

import { Link } from "react-router";

import { SessionDeleteDialog } from "@/pages/sessions/components/session-delete-dialog";
import { SessionLiveViewMenu } from "@/pages/sessions/components/session-live-view-menu";
import { SessionTitle } from "@/pages/sessions/components/session-title";

type TSessionOverviewProps = {
  session: TResponseGetSession;
};

const formatDate = (value: string | undefined) => {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleString();
};

const TokenStat = ({ label, value }: { label: string; value: number }) => (
  <div className="rounded-lg border bg-background p-3">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="mt-1 text-lg font-semibold tabular-nums">{value.toLocaleString()}</p>
  </div>
);

export function SessionOverview({ session }: TSessionOverviewProps) {
  const totals = session.tokenTotals;
  const domains = session.domains;

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
            {session.deletedAt ? "Deleted" : "Active"}
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
      </dl>
      {totals || domains.length > 0 ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {domains.length > 0 ? (
            <div className="rounded-lg border bg-background p-3">
              <p className="text-xs text-muted-foreground">
                {domains.length === 1 ? "Domain" : "Domains"}
              </p>
              <p className="mt-1 text-lg font-semibold break-all">{domains.join(", ")}</p>
            </div>
          ) : null}
          {totals ? (
            <>
              <TokenStat label="Total tokens" value={totals.totalTokens} />
              <TokenStat label="Prompt" value={totals.promptTokens} />
              <TokenStat label="Completion" value={totals.completionTokens} />
              <TokenStat label="Reasoning" value={totals.reasoningTokens} />
              <TokenStat label="Cache hit" value={totals.cacheHitTokens} />
              <TokenStat label="Cache miss" value={totals.cacheMissTokens} />
            </>
          ) : null}
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">No token usage recorded yet.</p>
      )}
    </div>
  );
}
