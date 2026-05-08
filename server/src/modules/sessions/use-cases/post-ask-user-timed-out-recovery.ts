import type { Express } from "express";

import { persistAskUserTimedOutRecovery, requireSessionExists } from "../../../session-service";
import { isTimedOutRecoveryBody } from "../validation/payload-guards";

export const registerPostAskUserTimedOutRecoveryRoute = (app: Express) => {
  app.post("/api/sessions/:sessionId/ask-user/recovery/timed-out", async (req, res) => {
    const payload = req.body as unknown;
    if (!isTimedOutRecoveryBody(payload)) {
      res.status(400).json({ error: "invalid payload" });
      return;
    }

    try {
      await requireSessionExists(req.params.sessionId);
    } catch {
      res.status(404).json({ error: "session not found" });
      return;
    }

    await persistAskUserTimedOutRecovery(req.params.sessionId, payload);
    res.status(204).end();
  });
};
