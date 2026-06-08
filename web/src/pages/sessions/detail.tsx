import type { TResponseGetSession } from "@project-yahl/server/modules/sessions/-api-types";

import { useOne } from "@refinedev/core";
import { useParams } from "react-router";

import { AskUserPendingBanner } from "@/pages/sessions/components/ask-user-pending-banner";
import { AskUserQuestionDialog } from "@/pages/sessions/components/ask-user-question-dialog";
import { SessionJsonFallback } from "@/pages/sessions/components/session-json-fallback";
import { SessionOverview } from "@/pages/sessions/components/session-overview";
import { SessionResult } from "@/pages/sessions/components/session-result";
import { SessionTimeline } from "@/pages/sessions/components/session-timeline";
import { useAskUserQuestions } from "@/pages/sessions/hooks/use-ask-user-questions";
import { useSessionEventsStream } from "@/pages/sessions/hooks/use-session-events-stream";
import { RESOURCES } from "@/providers/constants";

export function SessionDetailPage() {
  const { id } = useParams();

  const { query, result } = useOne<TResponseGetSession>({
    id: id ?? "",
    queryOptions: {
      enabled: !!id,
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
        <>
          <SessionOverview session={session} />
          <AskUserPendingBanner
            onOpenQuestion={openQuestion}
            questions={pendingQuestions}
          />
          <AskUserQuestionDialog
            onAnswered={handleAnswered}
            onOpenChange={setDialogOpen}
            open={dialogOpen}
            question={activeQuestion}
            sessionId={session.sessionId}
          />
          <SessionResult result={session.result} />
          <SessionTimeline
            error={stagesError}
            isLoading={stagesLoading}
            lastEvent={lastEvent}
            sessionId={session.sessionId}
            stages={stages}
          />
          <SessionJsonFallback label="Developer" value={session} />
        </>
      ) : null}
    </div>
  );
}
