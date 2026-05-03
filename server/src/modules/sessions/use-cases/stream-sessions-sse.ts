import type { Express } from "express";

import { subscribeSessionsSse } from "../../../session-sse-hub";

export const registerStreamSessionsSseRoute = (app: Express) => {
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
};
