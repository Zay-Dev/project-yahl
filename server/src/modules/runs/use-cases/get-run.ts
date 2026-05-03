import type { Express } from "express";

import type { ServerRoutesDeps } from "../../deps";

export const registerGetRunRoute = (app: Express, deps: ServerRoutesDeps) => {
  app.get("/api/runs/:runId", (req, res) => {
    const run = deps.runManager.getRun(req.params.runId);
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
};
