import type { Express } from "express";
import mongoose from "mongoose";

export const registerGetHealthRoute = (app: Express) => {
  app.get("/health", (_req, res) => {
    res.json({
      mongoReadyState: mongoose.connection.readyState,
      ok: true,
    });
  });
};
