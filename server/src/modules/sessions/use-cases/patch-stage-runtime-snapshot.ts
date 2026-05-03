import type { Express } from "express";

import { patchStageRuntimeSnapshot } from "../../../session-service";
import { isPatchStageRuntimeSnapshotBody } from "../validation/payload-guards";

export const registerPatchStageRuntimeSnapshotRoute = (app: Express) => {
  app.patch("/api/sessions/:sessionId/stages/:stageId/runtime-snapshot", async (req, res) => {
    const payload = req.body as unknown;
    const { sessionId, stageId } = req.params;

    if (!isPatchStageRuntimeSnapshotBody(payload)) {
      res.status(400).json({ error: "invalid payload" });
      return;
    }

    await patchStageRuntimeSnapshot(sessionId, stageId, payload);
    res.status(202).json({ ok: true });
  });
};
