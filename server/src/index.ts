import "dotenv/config";

import cors from "cors";
import express from "express";
import mongoose from "mongoose";
import { createRunManager } from "./run-manager";

import {
  appendUsageEvent,
  finalizeSession,
  hardDeleteSession,
  getSession,
  listSessions,
  registerSessionMetadataWithFork,
  softDeleteSession,
} from "./session-service";
import { subscribeSessionSse, subscribeSessionsSse } from "./session-sse-hub";
import type {
  FinalizeSessionPayload,
  RegisterSessionPayload,
  RerunRequestPayload,
  SessionUsagePayload,
} from "./types";

const app = express();
const runManager = createRunManager();

const port = Number(process.env.PORT || 4000);
const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/yahl";

app.use(cors());
app.use(express.json({ limit: "50mb" }));

const isUsagePayload = (value: unknown): value is SessionUsagePayload => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;

  const obj = value as Record<string, unknown>;
  if (typeof obj.sessionId !== "string") return false;
  if (typeof obj.requestId !== "string") return false;
  if (typeof obj.model !== "string") return false;
  if (typeof obj.thinkingMode !== "boolean") return false;
  if (typeof obj.timestamp !== "string") return false;
  if (!obj.usage || typeof obj.usage !== "object" || Array.isArray(obj.usage)) return false;

  const usage = obj.usage as Record<string, unknown>;
  const keys = ["cacheHitTokens", "cacheMissTokens", "completionTokens", "reasoningTokens"] as const;

  for (const key of keys) {
    if (typeof usage[key] !== "number" || !Number.isFinite(usage[key])) return false;
  }

  if (obj.stageInputTruncated !== undefined && typeof obj.stageInputTruncated !== "boolean") return false;

  return true;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const isRegisterBody = (value: unknown): value is RegisterSessionPayload => {
  if (!isRecord(value)) return false;

  if (typeof value.taskYahlPath !== "string") return false;
  if (value.forkedFrom === undefined) return true;
  if (!isRecord(value.forkedFrom)) return false;

  const forkedFrom = value.forkedFrom as Record<string, unknown>;
  if (typeof forkedFrom.sourceSessionId !== "string") return false;
  if (typeof forkedFrom.requestId !== "string") return false;
  if (typeof forkedFrom.stepIndex !== "number" || !Number.isInteger(forkedFrom.stepIndex)) return false;
  if (!Array.isArray(forkedFrom.prefixDump)) return false;

  return true;
};

const isRerunRequestBody = (value: unknown): value is RerunRequestPayload => {
  if (!isRecord(value)) return false;
  if (typeof value.sourceSessionId !== "string") return false;
  if (typeof value.sourceRequestId !== "string") return false;
  if (typeof value.resumeFromStepIndex !== "number" || !Number.isInteger(value.resumeFromStepIndex)) return false;
  if (!isRecord(value.requestSnapshotOverride)) return false;

  const override = value.requestSnapshotOverride as Record<string, unknown>;
  if (typeof override.currentStage !== "string") return false;
  if (!isRecord(override.context)) return false;

  return true;
};

const isFinalizeBody = (value: unknown): value is FinalizeSessionPayload => {
  if (value === undefined) return true;
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;

  return true;
};

const isCreateRunBody = (value: unknown): value is { taskId: string } => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;

  const obj = value as Record<string, unknown>;
  return typeof obj.taskId === "string" && !!obj.taskId.trim();
};


app.get("/health", (_req, res) => {
  res.json({
    mongoReadyState: mongoose.connection.readyState,
    ok: true,
  });
});

app.get("/api/tasks", async (_req, res) => {
  try {
    const tasks = await runManager.listTasks();
    res.json({
      items: tasks,
    });
  } catch (error) {
    res.status(500).json({
      error: String(error),
    });
  }
});

app.post("/api/runs", async (req, res) => {
  const body = req.body as unknown;
  if (!isCreateRunBody(body)) {
    res.status(400).json({ error: "invalid payload" });
    return;
  }

  const started = await runManager.startRun(body.taskId.trim());
  if (!started) {
    res.status(404).json({ error: "task not found" });
    return;
  }

  res.status(202).json(started);
});

app.get("/api/runs/:runId", (req, res) => {
  const run = runManager.getRun(req.params.runId);
  if (!run) {
    res.status(404).json({ error: "not found" });
    return;
  }

  res.json({
    createdAt: run.createdAt,
    exitCode: run.exitCode,
    runId: run.runId,
    sessionId: run.sessionId,
    status: run.status,
    taskId: run.taskId,
    taskPath: run.taskPath,
  });
});

app.get("/api/runs/:runId/logs/stream", (req, res) => {
  const { runId } = req.params;
  const run = runManager.getRun(runId);

  if (!run) {
    res.status(404).json({ error: "not found" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  if (typeof res.flushHeaders === "function") {
    res.flushHeaders();
  }

  const writeSse = (event: string, data: unknown) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  writeSse("meta", {
    createdAt: run.createdAt,
    runId: run.runId,
    sessionId: run.sessionId,
    status: run.status,
    taskId: run.taskId,
  });

  const unsubscribe = runManager.subscribeLogs(runId, (event) => {
    writeSse("log", event);
  });

  if (!unsubscribe) {
    res.status(404).json({ error: "not found" });
    return;
  }

  const heartbeat = setInterval(() => {
    res.write(`event: ping\ndata: {}\n\n`);
  }, 25_000);

  const statusTicker = setInterval(() => {
    const latest = runManager.getRun(runId);
    if (!latest) return;

    writeSse("status", {
      exitCode: latest.exitCode,
      status: latest.status,
    });
  }, 1_000);

  req.on("close", () => {
    clearInterval(heartbeat);
    clearInterval(statusTicker);
    unsubscribe();
  });
});

app.post("/api/sessions/:sessionId/register", async (req, res) => {
  const routeSessionId = req.params.sessionId;
  const body = req.body as unknown;

  if (!isRegisterBody(body)) {
    res.status(400).json({ error: "invalid payload" });
    return;
  }

  await registerSessionMetadataWithFork(routeSessionId, body.taskYahlPath, body.forkedFrom);
  res.status(202).json({ ok: true });
});

app.post("/api/requests/rerun", async (req, res) => {
  const body = req.body as unknown;
  if (!isRerunRequestBody(body)) {
    res.status(400).json({ error: "invalid payload" });
    return;
  }

  const source = await getSession(body.sourceSessionId);
  if (!source) {
    res.status(404).json({ error: "source session not found" });
    return;
  }

  const sourceEvent = source.events?.[body.resumeFromStepIndex];
  if (!sourceEvent || sourceEvent.requestId !== body.sourceRequestId) {
    res.status(400).json({ error: "invalid source request anchor" });
    return;
  }

  const taskPath = source.taskYahlPath;
  if (!taskPath) {
    res.status(400).json({ error: "source session missing task path" });
    return;
  }

  const prefixDump = (source.events || []).slice(0, body.resumeFromStepIndex);
  const started = await runManager.startRerunFromRequest({
    forkedFrom: {
      prefixDump,
      requestId: body.sourceRequestId,
      sourceSessionId: body.sourceSessionId,
      stepIndex: body.resumeFromStepIndex,
    },
    requestSnapshotOverride: body.requestSnapshotOverride,
    resumeExecutionMeta: sourceEvent.executionMeta,
    sourceRequestId: body.sourceRequestId,
    sourceSessionId: body.sourceSessionId,
    taskPath,
  });
  if (!started) {
    res.status(500).json({ error: "failed to start rerun" });
    return;
  }

  res.status(202).json(started);
});

app.post("/api/sessions/:sessionId/usage-events", async (req, res) => {
  const payload = req.body as unknown;
  const routeSessionId = req.params.sessionId;
  if (!isUsagePayload(payload)) {
    res.status(400).json({ error: "invalid payload" });
    return;
  }

  if (payload.sessionId !== routeSessionId) {
    res.status(400).json({ error: "sessionId mismatch" });
    return;
  }

  await appendUsageEvent(payload);
  res.status(202).json({ ok: true });
});

app.post("/api/sessions/:sessionId/finalize", async (req, res) => {
  const payload = req.body as unknown;
  if (!isFinalizeBody(payload)) {
    res.status(400).json({ error: "invalid payload" });
    return;
  }

  const result = payload && typeof payload === "object" && !Array.isArray(payload)
    ? (payload as FinalizeSessionPayload).result
    : undefined;
  await finalizeSession(req.params.sessionId, result);
  res.json({ ok: true });
});

app.get("/api/sessions/:sessionId/stream", async (req, res) => {
  const { sessionId } = req.params;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  if (typeof res.flushHeaders === "function") {
    res.flushHeaders();
  }

  const writeSse = (event: string, data: unknown) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const row = await getSession(sessionId);

  writeSse("meta", {
    finalizedAt: row?.finalizedAt ? new Date(row.finalizedAt).toISOString() : null,
    sessionId,
    taskYahlPath: row?.taskYahlPath ?? null,
  });

  const unsubscribe = subscribeSessionSse(sessionId, {
    onMeta: (meta) => {
      writeSse("meta", meta);
    },
    onStep: (step) => {
      writeSse("step", step);
    },
  });

  const heartbeat = setInterval(() => {
    res.write(`event: ping\ndata: {}\n\n`);
  }, 25_000);

  req.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});

app.get("/api/sessions/stream", (_req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  if (typeof res.flushHeaders === "function") {
    res.flushHeaders();
  }

  const writeSse = (event: string, data: unknown) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const unsubscribe = subscribeSessionsSse({
    onSession: (payload) => {
      writeSse("session", payload);
    },
  });

  const heartbeat = setInterval(() => {
    res.write(`event: ping\ndata: {}\n\n`);
  }, 25_000);

  res.write(`event: ready\ndata: {}\n\n`);

  res.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});

app.get("/api/sessions", async (req, res) => {
  const includeArchived = req.query.includeArchived === "true";
  const limit = Number(req.query.limit || 50);
  const offset = Number(req.query.offset || 0);
  const rows = await listSessions(limit, offset, includeArchived);

  res.json({
    items: rows,
    limit,
    offset,
  });
});

app.get("/api/sessions/:sessionId", async (req, res) => {
  const row = await getSession(req.params.sessionId);
  if (!row) {
    res.status(404).json({ error: "not found" });
    return;
  }

  res.json(row);
});

app.post("/api/sessions/:sessionId/soft-delete", async (req, res) => {
  const deleted = await softDeleteSession(req.params.sessionId);
  if (!deleted) {
    res.status(404).json({ error: "not found" });
    return;
  }

  res.json({ ok: true });
});

app.delete("/api/sessions/:sessionId", async (req, res) => {
  const deleted = await hardDeleteSession(req.params.sessionId);
  if (!deleted) {
    res.status(404).json({ error: "not found" });
    return;
  }

  res.json({ ok: true });
});

const start = async () => {
  await mongoose.connect(mongoUri);
  app.listen(port, () => {
    process.stdout.write(`[server] listening on ${port}\n`);
  });
};

start().catch((error: unknown) => {
  process.stderr.write(`[server] failed to boot: ${String(error)}\n`);
  process.exit(1);
});
