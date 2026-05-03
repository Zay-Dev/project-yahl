import type { Express } from "express";

import { createStageToolCalls } from "../../../session-service";
import { isCreateToolCallsBody } from "../validation/payload-guards";

export const registerCreateStageToolCallsRoute = (app: Express) => {
  app.post("/api/sessions/:sessionId/stages/:stageId/tool-calls", async (req, res) => {
    const payload = req.body as unknown;
    const { sessionId, stageId } = req.params;

    if (!isCreateToolCallsBody(payload)) {
      res.status(400).json({ error: "invalid payload" });
      return;
    }

    try {
      await createStageToolCalls(sessionId, stageId, payload);
      res.status(202).json({ ok: true });
    } catch (error) {
      res.status(409).json({ error: String(error) });
    }
  });
};
