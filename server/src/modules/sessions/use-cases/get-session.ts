import type { Express } from "express";

import { getSession } from "../../../session-service";

export const registerGetSessionRoute = (app: Express) => {
  app.get("/api/sessions/:sessionId", async (req, res) => {
    const row = await getSession(req.params.sessionId);
    if (!row) {
      res.status(404).json({ error: "not found" });
      return;
    }

    res.json(row);
  });
};
