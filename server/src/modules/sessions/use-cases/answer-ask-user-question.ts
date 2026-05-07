import type { Express } from "express";

import { answerAskUserQuestion } from "../../../session-service";
import { isAnswerAskUserQuestionBody } from "../validation/payload-guards";

export const registerAnswerAskUserQuestionRoute = (app: Express) => {
  app.post("/api/sessions/:sessionId/ask-user/questions/:questionId/answer", async (req, res) => {
    const payload = req.body as unknown;
    if (!isAnswerAskUserQuestionBody(payload)) {
      res.status(400).json({ error: "invalid payload" });
      return;
    }

    const row = await answerAskUserQuestion(req.params.sessionId, req.params.questionId, payload.answerIds);
    if (!row) {
      res.status(404).json({ error: "not found" });
      return;
    }

    const selected = row.options.filter((option) => (row.answerIds ?? []).includes(option.id));
    console.log(`[ask-user] answered session=${req.params.sessionId} question=${row.questionId}`);
    res.json({
      answeredAt: row.answeredAt ?? null,
      ok: true,
      questionId: row.questionId,
      selectedLabels: selected.map((option) => option.label),
    });
  });
};
