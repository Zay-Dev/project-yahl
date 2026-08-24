import type { TResponseGetSession } from "@project-yahl/server/modules/sessions/-api-types";

import { useOne } from "@refinedev/core";
import { useEffect, useState } from "react";
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
import { useUserPauseCheckpoints } from "@/pages/sessions/hooks/use-user-pause-checkpoints";
import { SessionRepairProvider } from "@/pages/sessions/hooks/session-repair-context";
import { RESOURCES } from "@/providers/constants";

const PAUSE_WAIT_POLL_MS = 1500;
const PAUSE_WAIT_TIMEOUT_MS = 60_000;
const RESUME_WAIT_POLL_MS = 1500;
const RESUME_WAIT_TIMEOUT_MS = 60_000;

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

  const {
    pendingCheckpoint: pendingUserPause,
    refetch: refetchUserPauseCheckpoints,
  } = useUserPauseCheckpoints({
    lastEvent,
    sessionId: id ?? '',
  });

  const [pausePending, setPausePending] = useState(false);
  const [pauseWaitError, setPauseWaitError] = useState<string | null>(null);
  const [resumePending, setResumePending] = useState(false);
  const [resumeWaitError, setResumeWaitError] = useState<string | null>(null);

  const handleTransportActionComplete = () => {
    void query.refetch();
    void refetchVerifyCheckpoints();
    void refetchUserPauseCheckpoints();
  };

  useEffect(() => {
    if (!pausePending) {
      return;
    }

    if (pendingUserPause || (session && session.runState !== 'active')) {
      setPausePending(false);
      setPauseWaitError(null);
    }
  }, [pausePending, pendingUserPause, session]);

  useEffect(() => {
    if (!pausePending) {
      return;
    }

    handleTransportActionComplete();

    const pollTimer = window.setInterval(() => {
      handleTransportActionComplete();
    }, PAUSE_WAIT_POLL_MS);

    const timeoutTimer = window.setTimeout(() => {
      setPausePending(false);
      setPauseWaitError('Pause timed out — orchestrator did not reach a safe point');
    }, PAUSE_WAIT_TIMEOUT_MS);

    return () => {
      window.clearInterval(pollTimer);
      window.clearTimeout(timeoutTimer);
    };
  }, [pausePending]);

  const handlePausePendingChange = (pending: boolean) => {
    setPausePending(pending);

    if (pending) {
      setPauseWaitError(null);
    }
  };

  useEffect(() => {
    if (!resumePending) {
      return;
    }

    if (session?.runState === 'active') {
      setResumePending(false);
      setResumeWaitError(null);
    }
  }, [resumePending, session]);

  useEffect(() => {
    if (!resumePending) {
      return;
    }

    handleTransportActionComplete();

    const pollTimer = window.setInterval(() => {
      handleTransportActionComplete();
    }, RESUME_WAIT_POLL_MS);

    const timeoutTimer = window.setTimeout(() => {
      setResumePending(false);
      setResumeWaitError('Resume timed out — orchestrator did not start');
    }, RESUME_WAIT_TIMEOUT_MS);

    return () => {
      window.clearInterval(pollTimer);
      window.clearTimeout(timeoutTimer);
    };
  }, [resumePending]);

  const handleResumePendingChange = (pending: boolean) => {
    setResumePending(pending);

    if (pending) {
      setResumeWaitError(null);
    }
  };

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
          <SessionOverview
            onActionComplete={handleTransportActionComplete}
            onPausePendingChange={handlePausePendingChange}
            onResumePendingChange={handleResumePendingChange}
            pausePending={pausePending}
            pauseWaitError={pauseWaitError}
            pendingUserPause={pendingUserPause}
            resumePending={resumePending}
            resumeWaitError={resumeWaitError}
            session={session}
            verifyAutoRetry={bannerState?.mode === 'auto_retry'}
          />
          <SessionRepairBar runState={session.runState} sessionId={session.sessionId} />
          {resumePending ? null : <SessionStuckBanner session={session} />}
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
            onActionComplete={handleTransportActionComplete}
            onPausePendingChange={handlePausePendingChange}
            onResumePendingChange={handleResumePendingChange}
            originalStages={session.parsedStages ?? []}
            pausePending={pausePending}
            pauseWaitError={pauseWaitError}
            pendingUserPause={pendingUserPause}
            resumePending={resumePending}
            resumeWaitError={resumeWaitError}
            session={session}
            sessionId={session.sessionId}
            stages={stages}
            startingRun={!session.parsedStages?.length && stages.length === 0}
            verifyAutoRetry={bannerState?.mode === 'auto_retry'}
          />
          <SessionJsonFallback label="Developer" value={session} />
        </SessionRepairProvider>
      ) : null}
    </div>
  );
}
