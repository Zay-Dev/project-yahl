import type { TResponseGetSession } from "@project-yahl/server/modules/sessions/-api-types";

import { useOne } from "@refinedev/core";
import { useParams } from "react-router";

import { AskUserPendingBanner } from "@/pages/sessions/components/ask-user-pending-banner";
import { SessionRepairBar } from "@/pages/sessions/components/session-repair-bar";
import { VerifyPendingBanner } from "@/pages/sessions/components/verify-pending-banner";
import { AskUserQuestionDialog } from "@/pages/sessions/components/ask-user-question-dialog";
import { SessionJsonFallback } from "@/pages/sessions/components/session-json-fallback";
import { SessionOverview } from "@/pages/sessions/components/session-overview";
import { SessionResult } from "@/pages/sessions/components/session-result";
import { SessionStuckBanner } from "@/pages/sessions/components/session-stuck-banner";
import { SessionTimeline } from "@/pages/sessions/components/session-timeline";
import { useAskUserQuestions } from "@/pages/sessions/hooks/use-ask-user-questions";
import { useSessionEventsStream } from "@/pages/sessions/hooks/use-session-events-stream";
import { useVerifyCheckpoints } from "@/pages/sessions/hooks/use-verify-checkpoints";
import { SessionRepairProvider } from "@/pages/sessions/hooks/session-repair-context";
import { RESOURCES } from "@/providers/constants";

const isSessionNotFoundError = (error: unknown) => {
  if (typeof error === "object" && error !== null && "statusCode" in error) {
    return (error as { statusCode?: number }).statusCode === 404;
  }

  if (error instanceof Error) {
    return /404|not found/i.test(error.message);
  }

  return false;
};

export function SessionDetailPage() {
  const { id } = useParams();

  const { query, result } = useOne<TResponseGetSession>({
    id: id ?? "",
    queryOptions: {
      enabled: !!id,
      retry: (failureCount, error) => failureCount < 10 && isSessionNotFoundError(error),
      retryDelay: 500,
    },
    resource: RESOURCES.sessions,
  });

  const {
    error: stagesError,
    isLoading: stagesLoading,
    lastEvent,
    stages,
  } = useSessionEventsStream({
    onSessionUpdated: () => {
      void query.refetch();
    },
    sessionId: id ?? "",
  });

  const {
    activeQuestion,
    dialogOpen,
    handleAnswered,
    openQuestion,
    pendingQuestions,
    setDialogOpen,
  } = useAskUserQuestions({
    lastEvent,
    sessionId: id ?? '',
  });

  const session = result;
  const error = query.error;
  const isLoading = query.isLoading;

  const {
    bannerState,
    refetch: refetchVerifyCheckpoints,
  } = useVerifyCheckpoints({
    lastEvent,
    session: session ?? null,
    sessionId: id ?? '',
    stages,
  });

  if (!id) {
    return <div className="rounded-xl bg-muted/50 p-4">Missing session id.</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      {isLoading ? (
        <div className="rounded-xl bg-muted/50 p-4">
          <p className="text-sm">Loading session…</p>
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl bg-muted/50 p-4">
          <p className="text-sm text-destructive">
            {error instanceof Error ? error.message : "Request failed"}
          </p>
        </div>
      ) : null}
      {session ? (
        <SessionRepairProvider sessionId={session.sessionId}>
          <SessionOverview session={session} />
          <SessionRepairBar sessionId={session.sessionId} />
          <SessionStuckBanner session={session} />
          <AskUserPendingBanner
            onOpenQuestion={openQuestion}
            questions={pendingQuestions}
          />
          {bannerState ? (
            <VerifyPendingBanner
              autoRetry={bannerState.mode === 'auto_retry'}
              checkpoint={bannerState.checkpoint}
              infraBusy={bannerState.mode === 'infra_busy'}
              onDismiss={() => void refetchVerifyCheckpoints()}
              sessionId={session.sessionId}
            />
          ) : null}
          <AskUserQuestionDialog
            onAnswered={handleAnswered}
            onOpenChange={setDialogOpen}
            open={dialogOpen}
            question={activeQuestion}
            sessionId={session.sessionId}
          />
          <SessionResult
            result={session.result}
            resultContextKey={session.resultContextKey}
          />
          <SessionTimeline
            error={stagesError}
            isLoading={stagesLoading}
            lastEvent={lastEvent}
            originalStages={session.parsedStages ?? []}
            sessionId={session.sessionId}
            stages={stages}
            startingRun={!session.parsedStages?.length && stages.length === 0}
          />
          <SessionJsonFallback label="Developer" value={session} />
        </SessionRepairProvider>
      ) : null}
    </div>
  );
}
