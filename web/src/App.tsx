import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCcw } from "lucide-react";

import {
  createRun,
  fetchTasks,
  fetchSessionById,
  fetchSessions,
  hardDeleteSession,
  openRunLogsSse,
  openSessionSse,
  openSessionsSse,
  rerunRequest,
  softDeleteSession,
} from "@/api";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type {
  RuntimeRun,
  RuntimeRunLogEvent,
  RuntimeRunMetaSse,
  RuntimeRunStatusSse,
  RuntimeTask,
  RerunRequestPayload,
  SessionDetail,
  SessionListItem,
  SessionMetaSse,
  SessionStepEvent,
  SessionStepSse,
} from "@/types";

const formatNumber = (value: number) => Intl.NumberFormat().format(value);
const formatCost = (value: number) => `$${value.toFixed(5)}`;
const formatDuration = (value: number) => {
  const totalMs = Math.max(0, Math.round(value));
  const hours = Math.floor(totalMs / 3_600_000);
  const minutes = Math.floor((totalMs % 3_600_000) / 60_000);
  const seconds = Math.floor((totalMs % 60_000) / 1_000);
  const milliseconds = totalMs % 1_000;
  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  const mmm = String(milliseconds).padStart(3, "0");
  return `${hh}:${mm}:${ss}.${mmm}`;
};
const STAGE_PREVIEW_LIMIT = 500;
const EMPTY_VALUE = "—";
const JSON_SPACING = 2;
const RUN_LOG_LIMIT = 300;

const getInputTokens = (event: SessionStepEvent) => event.usage.cacheHitTokens + event.usage.cacheMissTokens;
const getStagePreview = (event: SessionStepEvent) => {
  if (!event.stageInput || typeof event.stageInput !== "object") return EMPTY_VALUE;
  const stageInput = event.stageInput as { currentStage?: unknown };
  if (typeof stageInput.currentStage !== "string") return EMPTY_VALUE;
  const trimmed = stageInput.currentStage.trim();
  return trimmed || EMPTY_VALUE;
};
const truncateText = (value: string, max: number) => {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}...`;
};
const stringifyValue = (value: unknown) => {
  if (value === null || value === undefined) return EMPTY_VALUE;
  if (typeof value === "string") return value || EMPTY_VALUE;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value, null, JSON_SPACING);
};
const isLoopStep = (event: SessionStepEvent) => {
  if (!event.executionMeta || typeof event.executionMeta !== "object") return false;
  const executionMeta = event.executionMeta as { loopRef?: unknown };
  return typeof executionMeta.loopRef === "object" && executionMeta.loopRef !== null;
};
const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const toRequestSnapshot = (event: SessionStepEvent | null): RerunRequestPayload["requestSnapshotOverride"] | null => {
  if (!event?.stageInput || !isRecord(event.stageInput)) return null;
  const stageInput = event.stageInput as Record<string, unknown>;
  if (typeof stageInput.currentStage !== "string" || !isRecord(stageInput.context)) return null;
  const context = stageInput.context as Record<string, unknown>;
  return {
    context: {
      context: isRecord(context.context) ? context.context : {},
      stage: isRecord(context.stage) ? context.stage : {},
      types: isRecord(context.types) ? context.types : {},
    },
    currentStage: stageInput.currentStage,
  };
};
const getRequestSnapshot = (
  rows: Array<{ event: SessionStepEvent; index: number }>,
  fallback: SessionStepEvent | null,
) => {
  const fromRows = [...rows]
    .reverse()
    .map(({ event }) => toRequestSnapshot(event))
    .find((snapshot) => !!snapshot);
  return fromRows || toRequestSnapshot(fallback);
};
const getRequestGlobalStage = (rows: Array<{ event: SessionStepEvent; index: number }>) => {
  const scopedRows = [...rows].reverse();
  const globalRow = scopedRows.find(({ event }) => getStagePreview(event) !== EMPTY_VALUE) ?? scopedRows[0] ?? null;
  return globalRow;
};
const toLiveEvent = (step: SessionStepSse): SessionStepEvent => ({
  cost: step.cost,
  executionMeta: step.executionMeta,
  model: step.model,
  requestId: step.requestId || `live-${step.sessionId}-${step.stepIndex}`,
  response: step.durationMs !== null || step.replyPreview !== null
    ? {
      durationMs: step.durationMs ?? 0,
      reasoning: null,
      reply: step.replyPreview,
    }
    : undefined,
  sessionId: step.sessionId,
  stageInput: step.stageInput,
  stageInputTruncated: step.stageInputTruncated,
  thinkingMode: false,
  timestamp: "",
  usage: {
    cacheHitTokens: step.usage.cacheHitTokens,
    cacheMissTokens: step.usage.cacheMissTokens,
    completionTokens: step.usage.completionTokens,
    reasoningTokens: step.usage.reasoningTokens,
  },
});

const App = () => {
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveMeta, setLiveMeta] = useState<SessionMetaSse | null>(null);
  const [liveSteps, setLiveSteps] = useState<SessionStepSse[]>([]);
  const [modalStep, setModalStep] = useState<{ event: SessionStepEvent; index: number } | null>(null);
  const [resultModalOpen, setResultModalOpen] = useState(false);
  const [rerunDraftError, setRerunDraftError] = useState<string | null>(null);
  const [rerunDraftOpen, setRerunDraftOpen] = useState(false);
  const [rerunDraftStage, setRerunDraftStage] = useState("");
  const [rerunDraftContext, setRerunDraftContext] = useState("{}");
  const [rerunDraftStageContext, setRerunDraftStageContext] = useState("{}");
  const [rerunDraftTypes, setRerunDraftTypes] = useState("{}");
  const [rerunSubmitting, setRerunSubmitting] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [runLogs, setRunLogs] = useState<RuntimeRunLogEvent[]>([]);
  const [runMeta, setRunMeta] = useState<RuntimeRunMetaSse | null>(null);
  const [runState, setRunState] = useState<RuntimeRun | null>(null);
  const [runStatus, setRunStatus] = useState<RuntimeRunStatusSse | null>(null);
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<RuntimeTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const selectSession = useCallback((sessionId: string) => {
    setSelectedId(sessionId);
  }, []);

  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    setError(null);
    try {
      const rows = await fetchSessions();
      setSessions(rows);
      if (!rows.length) {
        setSelectedId(null);
        return;
      }

      if (!selectedId || !rows.some((row) => row.sessionId === selectedId)) {
        selectSession(rows[0].sessionId);
      }
    } catch (loadError) {
      setError(String(loadError));
    } finally {
      setSessionsLoading(false);
    }
  }, [selectedId, selectSession]);

  const loadTasks = useCallback(async () => {
    setTasksLoading(true);
    setRunError(null);
    try {
      const rows = await fetchTasks();
      setTasks(rows);
      if (!selectedTaskId && rows[0]) {
        setSelectedTaskId(rows[0].id);
      }
    } catch (loadError) {
      setRunError(String(loadError));
    } finally {
      setTasksLoading(false);
    }
  }, [selectedTaskId]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  useEffect(() => {
    const dispose = openSessionsSse({
      onSession: () => {
        void loadSessions();
      },
    });

    return () => {
      dispose();
    };
  }, [loadSessions]);

  useEffect(() => {
    if (selectedId) return;
    setDetail(null);
    setLiveMeta(null);
    setLiveSteps([]);
    setModalStep(null);
    setResultModalOpen(false);
  }, [selectedId]);

  useEffect(() => {
    if (!runState?.runId) return undefined;

    const dispose = openRunLogsSse(runState.runId, {
      onLog: (event) => {
        setRunLogs((prev) => [...prev, event].slice(-RUN_LOG_LIMIT));
      },
      onMeta: (meta) => {
        setRunMeta(meta);
      },
      onStatus: (status) => {
        setRunStatus(status);
      },
    });

    return () => {
      dispose();
    };
  }, [runState?.runId]);

  useEffect(() => {
    if (!selectedId) return;
    setDetailLoading(true);
    setError(null);
    void fetchSessionById(selectedId)
      .then(setDetail)
      .catch((loadError) => setError(String(loadError)))
      .finally(() => setDetailLoading(false));

    setModalStep(null);
    setResultModalOpen(false);
    setRerunDraftError(null);
    setRerunDraftOpen(false);
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) return undefined;

    setLiveMeta(null);
    setLiveSteps([]);

    let dispose: () => void = () => {};

    dispose = openSessionSse(selectedId, {
      onMeta: (meta) => {
        setLiveMeta(meta);
        if (meta.finalizedAt) dispose();
      },
      onStep: (step) => {
        setLiveSteps((prev) => [...prev, step]);
      },
    });

    return () => {
      dispose();
    };
  }, [selectedId]);

  const modelRows = useMemo(() => {
    if (!detail) return [];
    return Object.entries(detail.modelAggregates || {}).sort((a, b) => a[0].localeCompare(b[0]));
  }, [detail]);
  const groupedEvents = useMemo(() => {
    if (!detail?.events?.length) return [];
    const groups = new Map<string, Array<{ event: SessionStepEvent; index: number }>>();
    detail.events.forEach((event, index) => {
      const row = groups.get(event.requestId) || [];
      row.push({ event, index });
      groups.set(event.requestId, row);
    });
    return Array.from(groups.entries());
  }, [detail]);
  const groupedEventsByRequestId = useMemo(
    () => new Map(groupedEvents.map(([requestId, rows]) => [requestId, rows])),
    [groupedEvents],
  );
  const groupedLiveEvents = useMemo(() => {
    if (!liveSteps.length) return [];
    const groups = new Map<string, Array<{ event: SessionStepEvent; index: number }>>();
    liveSteps.forEach((step, index) => {
      const event = toLiveEvent(step);
      const row = groups.get(event.requestId) || [];
      row.push({ event, index });
      groups.set(event.requestId, row);
    });
    return Array.from(groups.entries());
  }, [liveSteps]);
  const detailTotalUsedTimeMs = useMemo(
    () => (detail?.events || []).reduce((sum, event) => {
      if (typeof event.response?.durationMs !== "number") return sum;
      return sum + event.response.durationMs;
    }, 0),
    [detail?.events],
  );

  const taskPath = liveMeta?.taskYahlPath ?? detail?.taskYahlPath ?? null;

  const openModalAtIndex = (index: number) => {
    const event = detail?.events?.[index];
    if (!event) return;
    setModalStep({ event, index });
  };
  const openModalAtRequestIndex = (requestIndex: number) => {
    const rows = groupedEvents[requestIndex]?.[1];
    const firstRow = rows?.[0];
    if (!firstRow) return;
    setModalStep({ event: firstRow.event, index: firstRow.index });
  };
  const openLiveRequestDetails = async (requestId: string) => {
    if (!selectedId) return;
    setError(null);
    try {
      const freshDetail = await fetchSessionById(selectedId);
      setDetail(freshDetail);
      const requestRows = freshDetail.events
        .map((event, index) => ({ event, index }))
        .filter((row) => row.event.requestId === requestId);
      if (!requestRows[0]) {
        setError(`Request ${requestId} is not persisted yet`);
        return;
      }
      setModalStep({ event: requestRows[0].event, index: requestRows[0].index });
    } catch (loadError) {
      setError(String(loadError));
    }
  };
  const modalRequestRows = modalStep ? (groupedEventsByRequestId.get(modalStep.event.requestId) || []) : [];
  const modalRequestGlobalStage = modalRequestRows.length ? getRequestGlobalStage(modalRequestRows) : null;
  const modalGlobalStageEvent = modalRequestGlobalStage?.event || modalStep?.event || null;
  const modalGlobalStageIndex = modalRequestGlobalStage?.index ?? modalStep?.index ?? null;
  const modalRequestSnapshot = getRequestSnapshot(modalRequestRows, modalGlobalStageEvent);
  const modalRequestIndex = modalStep ? groupedEvents.findIndex(([requestId]) => requestId === modalStep.event.requestId) : -1;
  const canOpenPrevRequest = modalRequestIndex > 0;
  const canOpenNextRequest = modalRequestIndex >= 0 && modalRequestIndex < groupedEvents.length - 1;
  const hasStoredResult = detail?.result !== undefined && detail?.result !== null;
  const removeSessionAndSelectNext = useCallback((sessionId: string) => {
    setSessions((prev) => {
      const next = prev.filter((session) => session.sessionId !== sessionId);
      if (selectedId === sessionId) {
        setSelectedId(next[0]?.sessionId ?? null);
      }
      return next;
    });
  }, [selectedId]);
  const onSoftDelete = useCallback(async () => {
    if (!selectedId) return;
    setError(null);
    try {
      await softDeleteSession(selectedId);
      removeSessionAndSelectNext(selectedId);
      await loadSessions();
    } catch (deleteError) {
      setError(String(deleteError));
    }
  }, [loadSessions, removeSessionAndSelectNext, selectedId]);
  const onHardDelete = useCallback(async () => {
    if (!selectedId) return;
    const confirmed = window.confirm("Permanently delete this session?");
    if (!confirmed) return;
    setError(null);
    try {
      await hardDeleteSession(selectedId);
      removeSessionAndSelectNext(selectedId);
      await loadSessions();
    } catch (deleteError) {
      setError(String(deleteError));
    }
  }, [loadSessions, removeSessionAndSelectNext, selectedId]);
  const onStartRun = useCallback(async () => {
    if (!selectedTaskId) return;

    setRunError(null);

    try {
      const created = await createRun(selectedTaskId);
      setRunLogs([]);
      setRunMeta(null);
      setRunState(created);
      setRunStatus({
        exitCode: null,
        status: created.status,
      });
      selectSession(created.sessionId);
      await loadSessions();
    } catch (startError) {
      setRunError(String(startError));
    }
  }, [loadSessions, selectSession, selectedTaskId]);
  const onOpenRerunDraft = useCallback(() => {
    if (!modalRequestSnapshot) {
      setRerunDraftError("Current request does not have a valid snapshot");
      return;
    }
    setRerunDraftError(null);
    setRerunDraftStage(modalRequestSnapshot.currentStage);
    setRerunDraftContext(stringifyValue(modalRequestSnapshot.context.context));
    setRerunDraftStageContext(stringifyValue(modalRequestSnapshot.context.stage));
    setRerunDraftTypes(stringifyValue(modalRequestSnapshot.context.types));
    setRerunDraftOpen(true);
  }, [modalRequestSnapshot]);
  const onSubmitRerun = useCallback(async () => {
    if (!selectedId || !modalStep || modalGlobalStageIndex === null) {
      setRerunDraftError("Missing source request anchor");
      return;
    }
    const parseJson = (raw: string, label: string) => {
      try {
        const value = JSON.parse(raw) as unknown;
        if (!isRecord(value)) throw new Error();
        return value;
      } catch {
        throw new Error(`${label} must be a valid JSON object`);
      }
    };

    setRerunDraftError(null);
    setRerunSubmitting(true);
    setRunError(null);
    try {
      const payload: RerunRequestPayload = {
        requestSnapshotOverride: {
          context: {
            context: parseJson(rerunDraftContext, "context.context"),
            stage: parseJson(rerunDraftStageContext, "context.stage"),
            types: parseJson(rerunDraftTypes, "context.types"),
          },
          currentStage: rerunDraftStage,
        },
        resumeFromStepIndex: modalGlobalStageIndex,
        sourceRequestId: modalStep.event.requestId,
        sourceSessionId: selectedId,
      };
      const created = await rerunRequest(payload);
      setRunLogs([]);
      setRunMeta(null);
      setRunState(created);
      setRunStatus({
        exitCode: null,
        status: created.status,
      });
      setRerunDraftOpen(false);
      selectSession(created.sessionId);
      await loadSessions();
    } catch (submitError) {
      setRerunDraftError(String(submitError));
    } finally {
      setRerunSubmitting(false);
    }
  }, [
    loadSessions,
    modalGlobalStageIndex,
    modalStep,
    rerunDraftContext,
    rerunDraftStage,
    rerunDraftStageContext,
    rerunDraftTypes,
    selectSession,
    selectedId,
  ]);

  return (
    <main className="mx-auto flex min-h-screen w-[90vw] max-w-none flex-col gap-4 p-4">

      {error ? <Card><CardContent className="pt-6 text-sm text-red-500">{error}</CardContent></Card> : null}
      {runError ? <Card><CardContent className="pt-6 text-sm text-red-500">{runError}</CardContent></Card> : null}

      <Card>
        <CardHeader>
          <CardTitle>Runtime Runner</CardTitle>
          <CardDescription>Select task, start orchestrator, watch logs</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="rounded border bg-background px-2 py-1 text-sm"
              disabled={tasksLoading || !tasks.length}
              onChange={(event) => setSelectedTaskId(event.target.value)}
              value={selectedTaskId}
            >
              {tasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.id}
                </option>
              ))}
            </select>
            <Button disabled={!selectedTaskId || tasksLoading} onClick={() => void onStartRun()} size="sm" variant="default">
              Start
            </Button>
            <Button onClick={() => void loadTasks()} size="sm" variant="outline">
              Refresh tasks
            </Button>
            {runState ? <Badge variant="outline">run: {runState.runId.slice(0, 8)}...</Badge> : null}
            {runMeta ? <Badge variant="secondary">session: {runMeta.sessionId.slice(0, 8)}...</Badge> : null}
            {runStatus ? (
              <Badge variant={runStatus.status === "running" ? "outline" : (runStatus.status === "completed" ? "default" : "secondary")}>
                {runStatus.status}
              </Badge>
            ) : null}
          </div>

          {runLogs.length ? (
            <pre className="max-h-64 overflow-auto rounded border p-2 text-xs">
              {runLogs.map((entry) => `[${entry.ts}] ${entry.line}`).join("\n")}
            </pre>
          ) : (
            <p className="text-sm text-muted-foreground">No run logs yet.</p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
        <Card className="w-full max-w-[400px]">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Sessions</CardTitle>
            <Button onClick={() => void loadSessions()} size="sm" variant="outline">
              <RefreshCcw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </CardHeader>
          <CardContent>
            {sessionsLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Session</TableHead>
                    <TableHead>Calls</TableHead>
                    <TableHead>Cost</TableHead>
                    <TableHead>Used Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((session) => (
                    <TableRow
                      className={selectedId === session.sessionId ? "bg-slate-100 dark:bg-slate-900" : ""}
                      key={session.sessionId}
                      onClick={() => selectSession(session.sessionId)}
                    >
                      <TableCell className="font-mono text-xs">{session.sessionId.slice(0, 8)}...</TableCell>
                      <TableCell>{formatNumber(session.totalCalls)}</TableCell>
                      <TableCell>{formatCost(session.totalCost)}</TableCell>
                      <TableCell>{formatDuration(session.totalUsedTimeMs || 0)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Session Detail</CardTitle>
            {detail?.sessionId ? <CardDescription className="font-mono text-xs">{detail.sessionId}</CardDescription> : null}
          </CardHeader>
          <CardContent className="max-h-[75vh] space-y-4 overflow-y-auto">
            {detailLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">events: {formatNumber(detail?.events.length || 0)}</Badge>
                  <Badge variant="secondary">used: {formatDuration(detailTotalUsedTimeMs)}</Badge>
                  <Badge variant={detail?.finalizedAt ? "default" : "outline"}>
                    {detail?.finalizedAt ? "finalized" : "active"}
                  </Badge>
                  <Button
                    disabled={!hasStoredResult}
                    onClick={() => setResultModalOpen(true)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    View result
                  </Button>
                  <Button
                    disabled={!selectedId}
                    onClick={() => void onSoftDelete()}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    Soft Delete
                  </Button>
                  <Button
                    disabled={!selectedId}
                    onClick={() => void onHardDelete()}
                    size="sm"
                    type="button"
                    variant="default"
                  >
                    Hard Delete
                  </Button>
                </div>

                {taskPath ? (
                  <p className="break-all font-mono text-xs text-muted-foreground">{taskPath}</p>
                ) : null}

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Model</TableHead>
                      <TableHead>Calls</TableHead>
                      <TableHead>Input</TableHead>
                      <TableHead>Output</TableHead>
                      <TableHead>Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {modelRows.map(([model, row]) => (
                      <TableRow key={model}>
                        <TableCell className="font-mono text-xs">{model}</TableCell>
                        <TableCell>{formatNumber(row.calls)}</TableCell>
                        <TableCell>{formatNumber(row.cacheHitTokens + row.cacheMissTokens)}</TableCell>
                        <TableCell>{formatNumber(row.completionTokens)}</TableCell>
                        <TableCell>{formatCost(row.cost)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {groupedEvents.length ? (
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium">Steps (persisted)</h3>
                    <div className="space-y-3">
                      {groupedEvents.map(([requestId, rows]) => (
                        <details className="overflow-hidden rounded-md border" key={requestId} open>
                          <summary className="flex cursor-pointer list-none items-center justify-between bg-muted px-3 py-2 text-xs">
                            <span className="font-mono">{requestId}</span>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary">steps: {formatNumber(rows.length)}</Badge>
                              <Button
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  openModalAtIndex(rows[0]?.index || 0);
                                }}
                                size="sm"
                                type="button"
                                variant="outline"
                              >
                                Request full details
                              </Button>
                            </div>
                          </summary>
                          <div className="p-2">
                            <Card className="mb-2">
                              <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-2 text-sm">
                                  <span>Current stage (request-global)</span>
                                  <Badge variant={isLoopStep((getRequestGlobalStage(rows)?.event) || rows[0].event) ? "default" : "outline"}>
                                    {isLoopStep((getRequestGlobalStage(rows)?.event) || rows[0].event) ? "loop" : "non-loop"}
                                  </Badge>
                                </CardTitle>
                                <CardDescription className="text-xs">
                                  source step #{getRequestGlobalStage(rows)?.index ?? rows[0].index}
                                </CardDescription>
                              </CardHeader>
                              <CardContent>
                                <p className="max-h-56 overflow-auto whitespace-pre-wrap rounded border p-2 font-mono text-xs">
                                  {truncateText(getStagePreview((getRequestGlobalStage(rows)?.event) || rows[0].event), STAGE_PREVIEW_LIMIT)}
                                </p>
                              </CardContent>
                            </Card>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>#</TableHead>
                                  <TableHead>Model</TableHead>
                                  <TableHead>ms</TableHead>
                                  <TableHead>Cost</TableHead>
                                  <TableHead>Tokens in</TableHead>
                                  <TableHead>Reply</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {rows.map(({ event, index }) => (
                                  <Fragment key={`${event.requestId}-${index}`}>
                                    <TableRow>
                                      <TableCell>{index}</TableCell>
                                      <TableCell className="font-mono text-xs">{event.model}</TableCell>
                                      <TableCell>{typeof event.response?.durationMs === "number" ? formatNumber(event.response.durationMs) : EMPTY_VALUE}</TableCell>
                                      <TableCell>{formatCost(event.cost ?? 0)}</TableCell>
                                      <TableCell>{formatNumber(getInputTokens(event))}</TableCell>
                                      <TableCell className="max-w-[200px] truncate text-xs">
                                        {event.response?.reply ?? EMPTY_VALUE}
                                      </TableCell>
                                    </TableRow>
                                  </Fragment>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </details>
                      ))}
                    </div>
                  </div>
                ) : null}

                {selectedId ? (
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium">Live stream (SSE)</h3>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">SSE: {liveMeta?.finalizedAt ? "closed" : "open"}</Badge>
                      {liveMeta?.finalizedAt ? (
                        <Badge variant="secondary">finalized {liveMeta.finalizedAt}</Badge>
                      ) : null}
                    </div>
                    {groupedLiveEvents.length ? (
                      <div className="space-y-3">
                        {groupedLiveEvents.map(([requestId, rows]) => (
                          <details className="overflow-hidden rounded-md border" key={requestId} open>
                            <summary className="flex cursor-pointer list-none items-center justify-between bg-muted px-3 py-2 text-xs">
                              <span className="font-mono">{requestId}</span>
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary">steps: {formatNumber(rows.length)}</Badge>
                                <Button
                                  onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    void openLiveRequestDetails(requestId);
                                  }}
                                  size="sm"
                                  type="button"
                                  variant="outline"
                                >
                                  Request full details
                                </Button>
                              </div>
                            </summary>
                            <div className="p-2">
                              <Card className="mb-2">
                                <CardHeader className="pb-3">
                                  <CardTitle className="flex items-center gap-2 text-sm">
                                    <span>Current stage (request-global)</span>
                                    <Badge variant={isLoopStep((getRequestGlobalStage(rows)?.event) || rows[0].event) ? "default" : "outline"}>
                                      {isLoopStep((getRequestGlobalStage(rows)?.event) || rows[0].event) ? "loop" : "non-loop"}
                                    </Badge>
                                  </CardTitle>
                                  <CardDescription className="text-xs">
                                    source step #{liveSteps[getRequestGlobalStage(rows)?.index ?? rows[0].index]?.stepIndex ?? (getRequestGlobalStage(rows)?.index ?? rows[0].index)}
                                  </CardDescription>
                                </CardHeader>
                                <CardContent>
                                  <p className="max-h-56 overflow-auto whitespace-pre-wrap rounded border p-2 font-mono text-xs">
                                    {truncateText(getStagePreview((getRequestGlobalStage(rows)?.event) || rows[0].event), STAGE_PREVIEW_LIMIT)}
                                  </p>
                                </CardContent>
                              </Card>
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Step</TableHead>
                                    <TableHead>Model</TableHead>
                                    <TableHead>ms</TableHead>
                                    <TableHead>Cost</TableHead>
                                    <TableHead>Tokens in</TableHead>
                                    <TableHead>Reply</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {rows.map(({ event, index }) => (
                                    <TableRow key={`${event.requestId}-${index}`}>
                                      <TableCell>{liveSteps[index]?.stepIndex ?? index}</TableCell>
                                      <TableCell className="font-mono text-xs">{event.model}</TableCell>
                                      <TableCell>{typeof event.response?.durationMs === "number" ? formatNumber(event.response.durationMs) : EMPTY_VALUE}</TableCell>
                                      <TableCell>{formatCost(event.cost ?? 0)}</TableCell>
                                      <TableCell>{formatNumber(getInputTokens(event))}</TableCell>
                                      <TableCell className="max-w-[240px] truncate text-xs">{event.response?.reply ?? EMPTY_VALUE}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </details>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No live steps yet. Waiting for model usage events.</p>
                    )}
                  </div>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {modalStep ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => {
            setModalStep(null);
            setRerunDraftError(null);
            setRerunDraftOpen(false);
          }}
        >
          <Card
            className="flex max-h-[95vh] w-full max-w-6xl flex-col"
            onClick={(event) => event.stopPropagation()}
          >
            <CardHeader className="flex shrink-0 flex-row items-center justify-between space-y-0 border-b">
              <div>
                <CardTitle>Step full details</CardTitle>
                <CardDescription>
                  Session {modalStep.event.sessionId} · Step #{modalStep.index}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  disabled={!canOpenPrevRequest}
                  onClick={() => openModalAtRequestIndex(modalRequestIndex - 1)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Prev
                </Button>
                <Button
                  disabled={!canOpenNextRequest}
                  onClick={() => openModalAtRequestIndex(modalRequestIndex + 1)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Next
                </Button>
                <Button
                  onClick={() => {
                    setModalStep(null);
                    setRerunDraftError(null);
                    setRerunDraftOpen(false);
                  }}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Close
                </Button>
              </div>
            </CardHeader>
            <CardContent
              className="flex-1 space-y-4 overflow-y-auto pt-4"
              key={`${modalStep.event.requestId}-${modalStep.index}`}
            >
              <div className="flex flex-wrap gap-2">
                <Badge variant="default">request: {modalStep.event.requestId}</Badge>
                <Badge variant="secondary">steps: {formatNumber(modalRequestRows.length || 1)}</Badge>
                <Badge variant="outline">session: {modalStep.event.sessionId}</Badge>
                <Button
                  disabled={!modalRequestSnapshot}
                  onClick={() => onOpenRerunDraft()}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Rerun from here
                </Button>
              </div>
              {modalGlobalStageEvent?.stageInputTruncated ? (
                <p className="text-xs text-amber-600">
                  Snapshot was marked truncated in source event. Review and edit carefully before rerun.
                </p>
              ) : null}

              {rerunDraftOpen ? (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Rerun Request Draft</CardTitle>
                    <CardDescription className="text-xs">
                      Forks into a new session and continues pipeline from this request boundary.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1">
                      <p className="text-xs font-medium">currentStage</p>
                      <textarea
                        className="min-h-28 w-full rounded border bg-background p-2 font-mono text-xs"
                        onChange={(event) => setRerunDraftStage(event.target.value)}
                        value={rerunDraftStage}
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium">context.context (JSON object)</p>
                      <textarea
                        className="min-h-24 w-full rounded border bg-background p-2 font-mono text-xs"
                        onChange={(event) => setRerunDraftContext(event.target.value)}
                        value={rerunDraftContext}
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium">context.stage (JSON object)</p>
                      <textarea
                        className="min-h-24 w-full rounded border bg-background p-2 font-mono text-xs"
                        onChange={(event) => setRerunDraftStageContext(event.target.value)}
                        value={rerunDraftStageContext}
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium">context.types (JSON object)</p>
                      <textarea
                        className="min-h-24 w-full rounded border bg-background p-2 font-mono text-xs"
                        onChange={(event) => setRerunDraftTypes(event.target.value)}
                        value={rerunDraftTypes}
                      />
                    </div>
                    {rerunDraftError ? (
                      <p className="text-xs text-red-500">{rerunDraftError}</p>
                    ) : null}
                    <div className="flex items-center gap-2">
                      <Button
                        disabled={rerunSubmitting}
                        onClick={() => void onSubmitRerun()}
                        size="sm"
                        type="button"
                        variant="default"
                      >
                        {rerunSubmitting ? "Submitting..." : "Start fork rerun"}
                      </Button>
                      <Button
                        disabled={rerunSubmitting}
                        onClick={() => {
                          setRerunDraftError(null);
                          setRerunDraftOpen(false);
                        }}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              <details className="overflow-hidden rounded-md border" open>
                <summary className="flex cursor-pointer list-none items-center justify-between bg-muted px-3 py-2 text-xs">
                  <span className="font-mono">Request-global context · {modalStep.event.requestId}</span>
                  <Badge variant="secondary">steps: {formatNumber(modalRequestRows.length || 1)}</Badge>
                </summary>
                <div className="space-y-4 p-3">
                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm">Stage input payload (request-global)</CardTitle>
                        <CardDescription className="text-xs">
                          source step #{modalGlobalStageIndex ?? modalStep.index}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <pre className="max-h-80 overflow-auto rounded border p-2 text-xs">
                          {stringifyValue(modalGlobalStageEvent?.stageInput)}
                        </pre>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm">Execution metadata (request-global)</CardTitle>
                        <CardDescription className="text-xs">
                          source step #{modalGlobalStageIndex ?? modalStep.index}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <pre className="max-h-80 overflow-auto rounded border p-2 text-xs">
                          {stringifyValue((modalGlobalStageEvent || modalStep.event).executionMeta)}
                        </pre>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <span>Current stage (request-global)</span>
                        <Badge variant={isLoopStep(modalGlobalStageEvent || modalStep.event) ? "default" : "outline"}>
                          {isLoopStep(modalGlobalStageEvent || modalStep.event) ? "loop" : "non-loop"}
                        </Badge>
                      </CardTitle>
                      <CardDescription className="text-xs">
                        source step #{modalGlobalStageIndex ?? modalStep.index}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="max-h-72 overflow-auto whitespace-pre-wrap rounded border p-3 font-mono text-xs">
                        {getStagePreview(modalGlobalStageEvent || modalStep.event)}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </details>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Request steps</CardTitle>
                </CardHeader>
                <CardContent>
                  <Accordion
                    className="w-full"
                    defaultValue={modalRequestRows.map(({ index }) => `step-${index}`)}
                    type="multiple"
                  >
                    {modalRequestRows.map(({ event, index }) => (
                      <AccordionItem key={`${event.requestId}-${index}`} value={`step-${index}`}>
                        <AccordionTrigger className="my-2 rounded-md bg-black px-3 text-xs text-white no-underline hover:no-underline">
                          <div className="flex w-full items-center justify-between gap-2 pr-2">
                            <span className="font-mono">Step #{index}</span>
                            <div className="flex items-center gap-2">
                              <Badge className="bg-white/10 text-white" variant="outline">{event.model}</Badge>
                              <Badge className="bg-white/20 text-white" variant="secondary">
                                {typeof event.response?.durationMs === "number" ? `${formatNumber(event.response.durationMs)}ms` : EMPTY_VALUE}
                              </Badge>
                              <Badge className="bg-white/20 text-white" variant="secondary">{formatCost(event.cost ?? 0)}</Badge>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                              <Card>
                                <CardHeader className="pb-3">
                                  <CardTitle className="text-sm">Step details</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2 text-xs">
                                  <p><span className="font-medium">Request ID:</span> {event.requestId}</p>
                                  <p><span className="font-medium">Session ID:</span> {event.sessionId}</p>
                                  <p><span className="font-medium">Timestamp:</span> {event.timestamp}</p>
                                </CardContent>
                              </Card>

                              <Card>
                                <CardHeader className="pb-3">
                                  <CardTitle className="text-sm">Model and timing</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2 text-xs">
                                  <p><span className="font-medium">Model:</span> {event.model}</p>
                                  <p>
                                    <span className="font-medium">Duration:</span>{" "}
                                    {typeof event.response?.durationMs === "number" ? formatNumber(event.response.durationMs) : EMPTY_VALUE}
                                    ms
                                  </p>
                                  <p><span className="font-medium">Cost:</span> {formatCost(event.cost ?? 0)}</p>
                                </CardContent>
                              </Card>

                              <Card>
                                <CardHeader className="pb-3">
                                  <CardTitle className="text-sm">Usage flags</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2 text-xs">
                                  <p><span className="font-medium">Thinking mode:</span> {event.thinkingMode ? "true" : "false"}</p>
                                  <p><span className="font-medium">Stage input truncated:</span> {event.stageInputTruncated ? "true" : "false"}</p>
                                  <p><span className="font-medium">Has execution meta:</span> {event.executionMeta ? "true" : "false"}</p>
                                  <p><span className="font-medium">Has stage input:</span> {event.stageInput ? "true" : "false"}</p>
                                </CardContent>
                              </Card>
                            </div>

                            <Card>
                              <CardHeader className="pb-3">
                                <CardTitle className="text-sm">Token usage breakdown</CardTitle>
                              </CardHeader>
                              <CardContent className="grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
                                <Badge className="justify-center" variant="secondary">
                                  cache hit: {formatNumber(event.usage.cacheHitTokens)}
                                </Badge>
                                <Badge className="justify-center" variant="secondary">
                                  cache miss: {formatNumber(event.usage.cacheMissTokens)}
                                </Badge>
                                <Badge className="justify-center" variant="secondary">
                                  completion: {formatNumber(event.usage.completionTokens)}
                                </Badge>
                                <Badge className="justify-center" variant="secondary">
                                  reasoning: {formatNumber(event.usage.reasoningTokens)}
                                </Badge>
                                <Badge className="justify-center" variant="outline">
                                  input total: {formatNumber(getInputTokens(event))}
                                </Badge>
                              </CardContent>
                            </Card>

                            <Card>
                              <CardHeader className="pb-3">
                                <CardTitle className="text-sm">Response payload</CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-3 text-xs">
                                <div className="space-y-1">
                                  <p className="font-medium">Reply</p>
                                  <p className="max-h-72 overflow-auto whitespace-pre-wrap rounded border p-2 font-mono text-xs">
                                    {stringifyValue(event.response?.reply)}
                                  </p>
                                </div>
                                <div className="space-y-1">
                                  <p className="font-medium">Reasoning</p>
                                  <p className="max-h-72 overflow-auto whitespace-pre-wrap rounded border p-2 font-mono text-xs">
                                    {stringifyValue(event.response?.reasoning)}
                                  </p>
                                </div>
                                <div className="space-y-1">
                                  <p className="font-medium">Tool calls</p>
                                  <pre className="max-h-72 overflow-auto rounded border p-2 text-xs">
                                    {stringifyValue(event.response?.toolCalls)}
                                  </pre>
                                </div>
                              </CardContent>
                            </Card>

                            <details className="rounded-md border">
                              <summary className="cursor-pointer list-none px-3 py-2 text-sm font-medium">
                                Raw event JSON
                              </summary>
                              <div className="p-3 pt-0">
                                <pre className="max-h-[40vh] overflow-auto rounded border p-2 text-xs">
                                  {JSON.stringify(event, null, JSON_SPACING)}
                                </pre>
                              </div>
                            </details>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {resultModalOpen && detail ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setResultModalOpen(false)}
        >
          <Card
            className="flex max-h-[95vh] w-full max-w-4xl flex-col"
            onClick={(event) => event.stopPropagation()}
          >
            <CardHeader className="flex shrink-0 flex-row items-center justify-between space-y-0 border-b">
              <div>
                <CardTitle>Session result</CardTitle>
                <CardDescription>Session {detail.sessionId}</CardDescription>
              </div>
              <Button onClick={() => setResultModalOpen(false)} size="sm" type="button" variant="outline">
                Close
              </Button>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto pt-4">
              <pre className="max-h-[70vh] overflow-auto rounded border p-2 text-xs">
                {stringifyValue(detail.result)}
              </pre>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </main>
  );
};

export default App;
