import type { Express } from "express";

import { finalizeSession } from "../../../session-service";
import type { FinalizeSessionPayload } from "../../../types";
import { isFinalizeBody } from "../validation/payload-guards";

export const registerFinalizeSessionRoute = (app: Express) => {
  app.post("/api/sessions/:sessionId/finalize", async (req, res) => {
    const payload = req.body as unknown;
    if (!isFinalizeBody(payload)) {
      res.status(400).json({ error: "invalid payload" });
      return;
    }

    const body = payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as FinalizeSessionPayload)
      : {};

    await finalizeSession(req.params.sessionId, {
      ...(body.result !== undefined ? { result: body.result } : {}),
      ...(body.resultA2ui !== undefined ? { resultA2ui: body.resultA2ui } : {}),
      ...(body.stages ? { stages: body.stages } : {}),
    });
    res.json({ ok: true });
  });
};
