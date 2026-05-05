import type { Express } from "express";
import mongoose from "mongoose";

import { getForkrunFormById } from "../../../session-service";

export const registerGetForkrunFormRoute = (app: Express) => {
  app.get("/api/forkrun-forms/:forkrunFormId", async (req, res) => {
    const forkrunFormId = req.params.forkrunFormId;

    if (!mongoose.Types.ObjectId.isValid(forkrunFormId)) {
      res.status(400).json({ error: "invalid forkrun form id" });
      return;
    }

    const row = await getForkrunFormById(forkrunFormId);
    if (!row) {
      res.status(404).json({ error: "not found" });
      return;
    }

    res.json(row);
  });
};
