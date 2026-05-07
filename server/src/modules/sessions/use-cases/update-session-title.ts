import type { Express } from "express";

import { renameSessionTitle } from "../../../session-service";
import { isUpdateSessionTitleBody } from "../validation/payload-guards";

export const registerUpdateSessionTitleRoute = (app: Express) => {
  app.patch("/api/sessions/:sessionId/title", async (req, res) => {
    const payload = req.body as unknown;
    if (!isUpdateSessionTitleBody(payload)) {
      res.status(400).json({ error: "invalid payload" });
      return;
    }

    const row = await renameSessionTitle(req.params.sessionId, payload.title);
    if (!row) {
      res.status(404).json({ error: "not found" });
      return;
    }

    res.json({
      ok: true,
      title: row.title ?? null,
      titleSource: row.titleSource ?? null,
    });
  });
};
