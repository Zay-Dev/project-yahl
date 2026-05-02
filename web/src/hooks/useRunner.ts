import { useCallback, useEffect, useState } from "react";

import {
  createRun,
  fetchTasks,
  openRunLogsSse,
  rerunRequest,
} from "@/api";
import type {
  RerunRequestPayload,
  RuntimeRun,
  RuntimeRunLogEvent,
  RuntimeRunMetaSse,
  RuntimeRunStatusSse,
  RuntimeTask,
} from "@/types";

const RUN_LOG_LIMIT = 300;

export const useRunner = () => {
  const [tasks, setTasks] = useState<RuntimeTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [run, setRun] = useState<RuntimeRun | null>(null);
  const [runMeta, setRunMeta] = useState<RuntimeRunMetaSse | null>(null);
  const [runStatus, setRunStatus] = useState<RuntimeRunStatusSse | null>(null);
  const [runLogs, setRunLogs] = useState<RuntimeRunLogEvent[]>([]);

  const refreshTasks = useCallback(async () => {
    setTasksLoading(true);
    setError(null);

    try {
      const rows = await fetchTasks();
      setTasks(rows);
      if (rows[0]) {
        setSelectedTaskId((current) => current || rows[0].id);
      }
    } catch (loadError) {
      setError(String(loadError));
    } finally {
      setTasksLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshTasks();
  }, [refreshTasks]);

  useEffect(() => {
    if (!run?.runId) return undefined;

    const dispose = openRunLogsSse(run.runId, {
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
  }, [run?.runId]);

  const startRun = useCallback(async () => {
    if (!selectedTaskId) return null;

    setError(null);

    try {
      const created = await createRun(selectedTaskId);
      setRunLogs([]);
      setRunMeta(null);
      setRun(created);
      setRunStatus({ exitCode: null, status: created.status });
      return created;
    } catch (startError) {
      setError(String(startError));
      return null;
    }
  }, [selectedTaskId]);

  const submitRerun = useCallback(async (payload: RerunRequestPayload) => {
    setError(null);

    try {
      const created = await rerunRequest(payload);
      setRunLogs([]);
      setRunMeta(null);
      setRun(created);
      setRunStatus({ exitCode: null, status: created.status });
      return created;
    } catch (rerunError) {
      setError(String(rerunError));
      return null;
    }
  }, []);

  return {
    error,
    refreshTasks,
    run,
    runLogs,
    runMeta,
    runStatus,
    selectedTaskId,
    setSelectedTaskId,
    startRun,
    submitRerun,
    tasks,
    tasksLoading,
  };
};
