import type { ErrorRequestHandler, Express } from "express";

export const registerErrorHandler = (app: Express) => {
  const handler: ErrorRequestHandler = (err, _req, res, next) => {
    if (res.headersSent) {
      next(err);
      return;
    }

    const status = (() => {
      if (typeof err !== "object" || err === null) return 500;
      const o = err as { status?: unknown; statusCode?: unknown };
      if (typeof o.status === "number") return o.status;
      if (typeof o.statusCode === "number") return o.statusCode;
      return 500;
    })();
    const message = err instanceof Error ? err.message : String(err);

    console.error("[server] route error", err);

    res.status(status).json({ error: message });
  };

  app.use(handler);
};
