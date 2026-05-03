import type { Express } from "express";

import type { ServerRoutesDeps } from "../../deps";
import {
  buildPrefixDumpForRerun,
  getSession,
  getSessionStageForAnchor,
} from "../../../session-service";
import { isRerunRequestBody } from "../validation/payload-guards";

export const registerRerunRequestRoute = (app: Express, deps: ServerRoutesDeps) => {
  app.post("/api/requests/rerun", async (req, res) => {
    const body = req.body as unknown;
    if (!isRerunRequestBody(body)) {
      res.status(400).json({ error: "invalid payload" });
      return;
    }

    const source = await getSession(body.sourceSessionId);
    if (!source) {
      res.status(404).json({ error: "source session not found" });
      return;
    }

    const anchorStage = await getSessionStageForAnchor(body.sourceSessionId, body.resumeFromStepIndex);
    if (!anchorStage || anchorStage.requestId !== body.sourceRequestId) {
      res.status(400).json({ error: "invalid source request anchor" });
      return;
    }

    const taskPath = source.taskYahlPath;
    if (!taskPath) {
      res.status(400).json({ error: "source session missing task path" });
      return;
    }

    const prefixDump = await buildPrefixDumpForRerun(body.sourceSessionId, body.resumeFromStepIndex);
    const started = await deps.runManager.startRerunFromRequest({
      forkedFrom: {
        prefixDump,
        requestId: body.sourceRequestId,
        sourceSessionId: body.sourceSessionId,
        stepIndex: body.resumeFromStepIndex,
      },
      requestSnapshotOverride: body.requestSnapshotOverride,
      resumeExecutionMeta: anchorStage.executionMeta,
      sourceRequestId: body.sourceRequestId,
      sourceSessionId: body.sourceSessionId,
      taskPath,
    });
    if (!started) {
      res.status(500).json({ error: "failed to start rerun" });
      return;
    }

    res.status(202).json(started);
  });
};
