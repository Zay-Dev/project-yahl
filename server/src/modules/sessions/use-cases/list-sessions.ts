import type { Express } from "express";

import { listSessions } from "../../../session-service";

export const registerListSessionsRoute = (app: Express) => {
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
};
