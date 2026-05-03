import type { Express } from "express";

import type { ServerRoutesDeps } from "../../deps";
import { isCreateRunBody } from "../validation/create-run-payload";

export const registerCreateRunRoute = (app: Express, deps: ServerRoutesDeps) => {
  app.post("/api/runs", async (req, res) => {
    const body = req.body as unknown;
    if (!isCreateRunBody(body)) {
      res.status(400).json({ error: "invalid payload" });
      return;
    }

    const started = await deps.runManager.startRun(body.taskId.trim());
    if (!started) {
      res.status(404).json({ error: "task not found" });
      return;
    }

    res.status(202).json(started);
  });
};
