import type { Express } from "express";

import { Session } from "../../../models";
import { getAskUserQuestion } from "../../../session-service";
import { isResumeAskUserBody } from "../validation/payload-guards";

import type { ServerRoutesDeps } from "../../deps";

export const registerResumeAskUserRoute = (app: Express, deps: ServerRoutesDeps) => {
  app.post("/api/sessions/:sessionId/ask-user/resume", async (req, res) => {
    const payload = req.body as unknown;
    if (!isResumeAskUserBody(payload)) {
      res.status(400).json({ error: "invalid payload" });
      return;
    }

    const sessionRow = await Session.findOne({ sessionId: req.params.sessionId }).lean();
    if (!sessionRow) {
      res.status(404).json({ error: "session not found" });
      return;
    }

    const recovery = sessionRow.askUserRecovery ?? null;
    if (!recovery) {
      res.status(404).json({ error: "no ask-user recovery pending" });
      return;
    }

    const questionId = payload.questionId || recovery.questionId;
    const question = await getAskUserQuestion(req.params.sessionId, questionId);
    if (!question || question.status !== "answered") {
      res.status(409).json({ error: "question not answered yet" });
      return;
    }

    if (recovery.questionId !== questionId) {
      res.status(400).json({ error: "questionId mismatch" });
      return;
    }

    if (!sessionRow.taskYahlPath?.trim()) {
      res.status(409).json({ error: "session has no taskYahlPath" });
      return;
    }

    const started = await deps.runManager.startAskUserResume(req.params.sessionId, sessionRow.taskYahlPath, {
      questionId: recovery.questionId,
      runtimeSnapshot: {
        context: recovery.runtimeSnapshot.context ?? {},
        stage: recovery.runtimeSnapshot.stage ?? {},
        types: recovery.runtimeSnapshot.types ?? {},
      },
      currentStageText: recovery.currentStageText,
      sourceRef: recovery.sourceRef,
      stageId: recovery.stageId,
      requestId: recovery.requestId,
    });

    res.status(202).json(started);
  });
};
