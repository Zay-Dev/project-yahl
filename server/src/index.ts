import "dotenv/config";

import cors from "cors";
import express from "express";
import mongoose from "mongoose";

import {
  appendUsageEvent,
  finalizeSession,
  getSession,
  listSessions,
  registerSessionMetadata,
} from "./session-service";
import { subscribeSessionSse, subscribeSessionsSse } from "./session-sse-hub";
import type { FinalizeSessionPayload, SessionUsagePayload } from "./types";

const app = express();

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

const isRegisterBody = (value: unknown): value is { taskYahlPath: string } => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;

  const obj = value as Record<string, unknown>;

  return typeof obj.taskYahlPath === "string";
};

const isFinalizeBody = (value: unknown): value is FinalizeSessionPayload => {
  if (value === undefined) return true;
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;

  return true;
};

app.get("/health", (_req, res) => {
  res.json({
    mongoReadyState: mongoose.connection.readyState,
    ok: true,
  });
});

app.post("/api/sessions/:sessionId/register", async (req, res) => {
  const routeSessionId = req.params.sessionId;
  const body = req.body as unknown;

  if (!isRegisterBody(body)) {
    res.status(400).json({ error: "invalid payload" });
    return;
  }

  await registerSessionMetadata(routeSessionId, body.taskYahlPath);
  res.status(202).json({ ok: true });
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
  const limit = Number(req.query.limit || 50);
  const offset = Number(req.query.offset || 0);
  const rows = await listSessions(limit, offset);

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
