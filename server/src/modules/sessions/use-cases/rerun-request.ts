import type { Express } from "express";

import type { ServerRoutesDeps } from "../../deps";
import {
  buildPrefixSnapshotsForRerun,
  createForkrunForm,
  getSession,
  getSessionStageById,
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

    const parsedStages = source.stages;
    if (!parsedStages?.length) {
      res.status(400).json({
        error: "source session has no finalized stages; finalize the session before rerun",
      });
      return;
    }

    const anchorStage = await getSessionStageById(body.sourceSessionId, body.sourceStageId);
    if (!anchorStage || anchorStage.requestId !== body.sourceRequestId) {
      res.status(400).json({ error: "invalid source request anchor" });
      return;
    }

    if (typeof anchorStage.executionSequence !== "number") {
      res.status(400).json({ error: "anchor stage missing executionSequence" });
      return;
    }

    const prefixSnapshots = await buildPrefixSnapshotsForRerun(
      body.sourceSessionId,
      anchorStage.executionSequence,
    );

    const hasTruncatedPrefix = prefixSnapshots.some(
      (row) => row.contextAfterTruncated === true || row.contextBeforeTruncated === true,
    );
    if (hasTruncatedPrefix) {
      res.status(400).json({ error: "prefix stages include truncated context; cannot replay safely" });
      return;
    }

    const missingAfter = prefixSnapshots.some((s) => s.contextAfter === undefined || s.contextAfter === null);
    if (missingAfter && anchorStage.executionSequence > 0) {
      res.status(400).json({ error: "prefix stages missing contextAfter; cannot fast-forward" });
      return;
    }

    const forkrunForm = await createForkrunForm({
      anchorStageIndex: anchorStage.stageIndex,
      requestSnapshotOverride: body.requestSnapshotOverride as {
        context: {
          context: Record<string, unknown>;
          stage: Record<string, unknown>;
          types: Record<string, unknown>;
        };
        currentStage: string;
      },
      sourceRequestId: body.sourceRequestId,
      sourceSessionId: body.sourceSessionId,
      sourceStageId: body.sourceStageId,
    });

    const started = await deps.runManager.startRerunFromRequest({
      forkrunFormId: forkrunForm._id,
      forkedFrom: {
        prefixSnapshots,
        requestId: body.sourceRequestId,
        sourceSessionId: body.sourceSessionId,
        stepIndex: anchorStage.stageIndex,
      },
      requestSnapshotOverride: body.requestSnapshotOverride,
      resumeExecutionMeta: anchorStage.executionMeta,
      sourceRequestId: body.sourceRequestId,
      sourceSessionId: body.sourceSessionId,
      sourceStageId: body.sourceStageId,
    });

    res.status(202).json(started);
  });
};
