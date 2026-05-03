import type { Express } from "express";

import type { ServerRoutesDeps } from "../../deps";

export const registerStreamRunLogsSseRoute = (app: Express, deps: ServerRoutesDeps) => {
  app.get("/api/runs/:runId/logs/stream", (req, res) => {
    const { runId } = req.params;
    const run = deps.runManager.getRun(runId);

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

    const unsubscribe = deps.runManager.subscribeLogs(runId, (event) => {
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
      const latest = deps.runManager.getRun(runId);
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
};
