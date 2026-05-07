import type { Express } from "express";

import { getAskUserQuestion } from "../../../session-service";

export const registerGetAskUserQuestionRoute = (app: Express) => {
  app.get("/api/sessions/:sessionId/ask-user/questions/:questionId", async (req, res) => {
    const row = await getAskUserQuestion(req.params.sessionId, req.params.questionId);
    if (!row) {
      res.status(404).json({ error: "not found" });
      return;
    }

    res.json({
      allowMultiple: row.allowMultiple,
      answerIds: row.answerIds ?? [],
      answeredAt: row.answeredAt ?? null,
      options: row.options,
      questionId: row.questionId,
      requestId: row.requestId,
      stageId: row.stageId,
      status: row.status,
      title: row.title,
    });
  });
};
