import type { Express } from "express";

import { createStageModelResponse } from "../../../session-service";
import { isCreateModelResponseBody } from "../validation/payload-guards";

export const registerCreateStageModelResponseRoute = (app: Express) => {
  app.post("/api/sessions/:sessionId/stages/:stageId/model-responses", async (req, res) => {
    const payload = req.body as unknown;
    const { sessionId, stageId } = req.params;

    if (!isCreateModelResponseBody(payload)) {
      res.status(400).json({ error: "invalid payload" });
      return;
    }

    try {
      await createStageModelResponse(sessionId, stageId, payload);
      res.status(202).json({ ok: true });
    } catch (error) {
      res.status(409).json({ error: String(error) });
    }
  });
};
