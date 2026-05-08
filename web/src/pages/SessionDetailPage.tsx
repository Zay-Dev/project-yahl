import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useRunnerContext } from "@/app/RunnerContext";
import {
  hardDeleteSession,
  resumeAskUserAfterTimeout,
  softDeleteSession,
  updateSessionTitle,
} from "@/api";
import { LiveStreamPanel } from "@/components/session/LiveStreamPanel";
import { AskUserPanel } from "@/components/session/AskUserPanel";
import { ModelAggregatesTable } from "@/components/session/ModelAggregatesTable";
import { RequestGroup } from "@/components/session/RequestGroup";
import { RerunDraftDialog } from "@/components/session/RerunDraftDialog";
import { SessionResultDialog } from "@/components/session/SessionResultDialog";
import { SessionSummary } from "@/components/session/SessionSummary";
import { StepDetailsDialog } from "@/components/session/StepDetailsDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useSessionDetail } from "@/hooks/useSessionDetail";
import {
  groupEventsByRequestId,
  type SessionEventGroup,
} from "@/lib/session-events";
import type { SessionStepEvent } from "@/types";

export const SessionDetailPage = () => {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId ?? null;
  const navigate = useNavigate();

  const {
    detail,
    error,
    liveMeta,
    liveSteps,
    loading,
    refresh,
    setDetail,
  } = useSessionDetail(sessionId);
  const { submitRerun } = useRunnerContext();

  const [modalStep, setModalStep] = useState<{ event: SessionStepEvent; index: number } | null>(null);
  const [resultOpen, setResultOpen] = useState(false);
  const [rerunOpen, setRerunOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [resumeMessage, setResumeMessage] = useState<string | null>(null);
  const [resumeBusy, setResumeBusy] = useState(false);
  const [dismissedRecoveryQuestionId, setDismissedRecoveryQuestionId] = useState<string | null>(null);

  const groupedEvents: SessionEventGroup[] = useMemo(
    () => groupEventsByRequestId(detail?.events ?? []),
    [detail?.events],
  );

  const totalUsedMs = useMemo(
    () =>
      (detail?.events || []).reduce((sum, event) => {
        if (typeof event.response?.durationMs !== "number") return sum;
        return sum + event.response.durationMs;
      }, 0),
    [detail?.events],
  );

  const taskPath = liveMeta?.taskYahlPath ?? detail?.taskYahlPath ?? null;
  const hasStoredResult = detail?.result !== undefined && detail?.result !== null;

  const askUserRecoveryResume = useMemo(() => {
    const recovery = detail?.askUserRecovery;
    if (!recovery) return null;
    if (dismissedRecoveryQuestionId && recovery.questionId === dismissedRecoveryQuestionId) return null;
    const matched = detail?.askUserQuestions?.find((q) => q.questionId === recovery.questionId);
    return {
      answered: matched?.status === "answered",
      recovery,
    };
  }, [detail?.askUserQuestions, detail?.askUserRecovery, dismissedRecoveryQuestionId]);

  useEffect(() => {
    if (!detail?.askUserRecovery || !dismissedRecoveryQuestionId) return;
    if (detail.askUserRecovery.questionId !== dismissedRecoveryQuestionId) {
      setDismissedRecoveryQuestionId(null);
    }
  }, [detail?.askUserRecovery, dismissedRecoveryQuestionId]);

  useEffect(() => {
    if (!sessionId) return;
    const interval = setInterval(() => {
      void refresh();
    }, 1200);
    return () => {
      clearInterval(interval);
    };
  }, [refresh, sessionId]);

  const openModalAtIndex = useCallback(
    (index: number) => {
      const event = detail?.events?.[index];
      if (!event) return;
      setModalStep({ event, index });
    },
    [detail?.events],
  );

  const openLiveRequestDetails = useCallback(
    async (requestId: string) => {
      if (!sessionId) return;
      const fresh = await refresh();
      if (!fresh) return;

      const requestRows = fresh.events
        .map((event, index) => ({ event, index }))
        .filter((row) => row.event.requestId === requestId);

      if (!requestRows[0]) {
        setActionError(`Request ${requestId} is not persisted yet`);
        return;
      }

      setModalStep({ event: requestRows[0].event, index: requestRows[0].index });
    },
    [refresh, sessionId],
  );

  const onSoftDelete = useCallback(async () => {
    if (!sessionId) return;
    setActionError(null);
    try {
      await softDeleteSession(sessionId);
      navigate("/sessions");
    } catch (deleteError) {
      setActionError(String(deleteError));
    }
  }, [navigate, sessionId]);

  const onHardDelete = useCallback(async () => {
    if (!sessionId) return;
    setActionError(null);
    try {
      await hardDeleteSession(sessionId);
      navigate("/sessions");
    } catch (deleteError) {
      setActionError(String(deleteError));
    }
  }, [navigate, sessionId]);

  const onResumeAskUser = useCallback(async () => {
    if (!sessionId || !askUserRecoveryResume) return;
    setActionError(null);
    setResumeMessage(null);
    setResumeBusy(true);
    try {
      const run = await resumeAskUserAfterTimeout(sessionId, askUserRecoveryResume.recovery.questionId);
      setResumeMessage(`Resume run started (run ${run.runId.slice(0, 8)}…).`);
      setDismissedRecoveryQuestionId(askUserRecoveryResume.recovery.questionId);
      setDetail((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          askUserRecovery: null,
        };
      });
      await refresh();
    } catch (resumeError) {
      setActionError(String(resumeError));
    } finally {
      setResumeBusy(false);
    }
  }, [askUserRecoveryResume, refresh, sessionId]);

  const onRenameTitle = useCallback(async (title: string) => {
    if (!sessionId) return;
    setActionError(null);
    try {
      await updateSessionTitle(sessionId, title);
      await refresh();
    } catch (renameError) {
      setActionError(String(renameError));
    }
  }, [refresh, sessionId]);

  if (!sessionId) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-slate-500 dark:text-slate-400">
          No session selected.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {(error || actionError) ? (
        <Card>
          <CardContent className="pt-6 text-sm text-red-500">{error || actionError}</CardContent>
        </Card>
      ) : null}

      {resumeMessage ? (
        <Card>
          <CardContent className="pt-6 text-sm text-slate-700 dark:text-slate-200">{resumeMessage}</CardContent>
        </Card>
      ) : null}

      <Card>
        <SessionSummary
          detail={detail}
          hasStoredResult={hasStoredResult}
          onHardDelete={onHardDelete}
          onRenameTitle={onRenameTitle}
          onSoftDelete={onSoftDelete}
          onViewResult={() => setResultOpen(true)}
          taskPath={taskPath}
          totalUsedMs={totalUsedMs}
        />

        <CardContent className="space-y-6">
          {loading && !detail ? (
            <div className="space-y-2">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : (
            <>
              <section className="space-y-2">
                <h3 className="text-sm font-medium">Model usage</h3>
                <ModelAggregatesTable detail={detail} />
              </section>

              {groupedEvents.length ? (
                <section className="space-y-2">
                  <h3 className="text-sm font-medium">Steps (persisted)</h3>
                  <div className="space-y-2">
                    {groupedEvents.map(([requestId, rows]) => (
                      <RequestGroup
                        key={requestId}
                        onOpenDetails={(rowIndex) => openModalAtIndex(rowIndex)}
                        requestId={requestId}
                        rows={rows}
                      />
                    ))}
                  </div>
                </section>
              ) : null}

              <LiveStreamPanel
                liveMeta={liveMeta}
                liveSteps={liveSteps}
                onOpenLiveRequestDetails={(requestId) => void openLiveRequestDetails(requestId)}
              />

              {askUserRecoveryResume ? (
                <Card>
                  <CardContent className="space-y-2 pt-6">
                    <h3 className="text-sm font-medium">Ask-user timed out</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      The orchestrator stopped waiting for this question. After you answer below, you can resume
                      from the saved checkpoint.
                    </p>
                    {!askUserRecoveryResume.answered ? (
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        Submit your answer for question &quot;{askUserRecoveryResume.recovery.questionId}&quot;, then
                        use Resume.
                      </p>
                    ) : null}
                    <Button
                      disabled={!askUserRecoveryResume.answered || resumeBusy}
                      onClick={() => void onResumeAskUser()}
                      size="sm"
                    >
                      Resume from checkpoint
                    </Button>
                  </CardContent>
                </Card>
              ) : null}

              {detail?.askUserQuestions?.length ? (
                <AskUserPanel
                  onAnswered={async () => {
                    await refresh();
                    setTimeout(() => {
                      void refresh();
                    }, 400);
                  }}
                  questions={detail.askUserQuestions}
                  sessionId={sessionId}
                />
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      <StepDetailsDialog
        groupedEvents={groupedEvents}
        modalStep={modalStep}
        onClose={() => setModalStep(null)}
        onNavigate={(event, index) => setModalStep({ event, index })}
        onOpenRerun={() => setRerunOpen(true)}
      />

      <RerunDraftDialog
        groupedEvents={groupedEvents}
        modalStep={modalStep}
        onClose={() => setRerunOpen(false)}
        onForkSuccess={(created) => {
          setRerunOpen(false);
          setModalStep(null);
          setDetail(null);
          navigate(`/sessions/${created.sessionId}`);
        }}
        open={rerunOpen}
        sessionId={sessionId}
        submitRerun={submitRerun}
      />

      <SessionResultDialog
        detail={detail}
        onClose={() => setResultOpen(false)}
        open={resultOpen}
      />
    </div>
  );
};
