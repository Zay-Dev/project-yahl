import type { Express } from "express";

import { createStage } from "../../../session-service";
import { isCreateStageBody } from "../validation/payload-guards";

export const registerCreateStageRoute = (app: Express) => {
  app.post("/api/sessions/:sessionId/stages", async (req, res) => {
    const payload = req.body as unknown;
    const { sessionId } = req.params;

    if (!isCreateStageBody(payload)) {
      res.status(400).json({ error: "invalid payload" });
      return;
    }

    if (payload.stageId !== payload.executionMeta.stageId) {
      res.status(400).json({ error: "stageId mismatch with executionMeta" });
      return;
    }

    try {
      const created = await createStage(sessionId, payload);
      res.status(202).json({ ok: true, stageIndex: created.stageIndex });
    } catch (error) {
      res.status(409).json({ error: String(error) });
    }
  });
};
