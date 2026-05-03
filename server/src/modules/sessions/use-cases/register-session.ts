import type { Express } from "express";

import { registerSessionMetadataWithFork } from "../../../session-service";
import { isRegisterBody } from "../validation/payload-guards";

export const registerRegisterSessionRoute = (app: Express) => {
  app.post("/api/sessions/:sessionId/register", async (req, res) => {
    const routeSessionId = req.params.sessionId;
    const body = req.body as unknown;

    if (!isRegisterBody(body)) {
      res.status(400).json({ error: "invalid payload" });
      return;
    }

    await registerSessionMetadataWithFork(routeSessionId, body.taskYahlPath, body.forkLineage);
    res.status(202).json({ ok: true });
  });
};
