import type { Express } from "express";

import { softDeleteSession } from "../../../session-service";

export const registerSoftDeleteSessionRoute = (app: Express) => {
  app.post("/api/sessions/:sessionId/soft-delete", async (req, res) => {
    const deleted = await softDeleteSession(req.params.sessionId);
    if (!deleted) {
      res.status(404).json({ error: "not found" });
      return;
    }

    res.json({ ok: true });
  });
};
