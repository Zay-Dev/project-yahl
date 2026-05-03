import type { Express } from "express";

import type { ServerRoutesDeps } from "../../deps";

export const registerListTasksRoute = (app: Express, deps: ServerRoutesDeps) => {
  app.get("/api/tasks", async (_req, res) => {
    try {
      const tasks = await deps.runManager.listTasks();
      res.json({
        items: tasks,
      });
    } catch (error) {
      res.status(500).json({
        error: String(error),
      });
    }
  });
};
