import type { Express } from "express";

import { getSession } from "../../../session-service";
import { subscribeSessionSse } from "../../../session-sse-hub";

export const registerStreamSessionSseRoute = (app: Express) => {
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
};
