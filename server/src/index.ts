import "dotenv/config";

import cors from "cors";
import express from "express";
import mongoose from "mongoose";

import { appendUsageEvent, finalizeSession, getSession, listSessions } from "./session-service";
import type { SessionUsagePayload } from "./types";

const app = express();

const port = Number(process.env.PORT || 4000);
const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/yahl";

app.use(cors());
app.use(express.json({ limit: "2mb" }));

const isUsagePayload = (value: unknown): value is SessionUsagePayload => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;

  const obj = value as Record<string, unknown>;
  if (typeof obj.sessionId !== "string") return false;
  if (typeof obj.requestId !== "string") return false;
  if (typeof obj.model !== "string") return false;
  if (typeof obj.thinkingMode !== "boolean") return false;
  if (typeof obj.timestamp !== "string") return false;
  if (!obj.usage || typeof obj.usage !== "object" || Array.isArray(obj.usage)) return false;

  return true;
};

app.get("/health", (_req, res) => {
  res.json({
    mongoReadyState: mongoose.connection.readyState,
    ok: true,
  });
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
  await finalizeSession(req.params.sessionId);
  res.json({ ok: true });
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
