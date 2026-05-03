import type { Express } from "express";

import { hardDeleteSession } from "../../../session-service";

export const registerHardDeleteSessionRoute = (app: Express) => {
  app.delete("/api/sessions/:sessionId", async (req, res) => {
    const deleted = await hardDeleteSession(req.params.sessionId);
    if (!deleted) {
      res.status(404).json({ error: "not found" });
      return;
    }

    res.json({ ok: true });
  });
};
