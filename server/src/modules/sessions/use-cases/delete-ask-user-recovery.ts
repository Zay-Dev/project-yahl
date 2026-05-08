import type { Express } from "express";

import { clearAskUserRecovery, requireSessionExists } from "../../../session-service";

export const registerDeleteAskUserRecoveryRoute = (app: Express) => {
  app.delete("/api/sessions/:sessionId/ask-user/recovery", async (req, res) => {
    try {
      await requireSessionExists(req.params.sessionId);
    } catch {
      res.status(404).json({ error: "session not found" });
      return;
    }

    await clearAskUserRecovery(req.params.sessionId);
    res.status(204).end();
  });
};
