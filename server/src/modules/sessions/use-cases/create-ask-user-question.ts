import type { Express } from "express";

import { toA2uiMultipleChoice } from "../a2ui";
import { createAskUserQuestion } from "../../../session-service";
import { isCreateAskUserQuestionBody } from "../validation/payload-guards";

export const registerCreateAskUserQuestionRoute = (app: Express) => {
  app.post("/api/sessions/:sessionId/ask-user/questions", async (req, res) => {
    const payload = req.body as unknown;
    if (!isCreateAskUserQuestionBody(payload)) {
      res.status(400).json({ error: "invalid payload" });
      return;
    }

    try {
      const questionId = await createAskUserQuestion(req.params.sessionId, payload);
      console.log(`[ask-user] rendered session=${req.params.sessionId} question=${questionId}`);
      res.status(202).json({
        a2ui: toA2uiMultipleChoice(`ask-user-${questionId}`, payload.question),
        ok: true,
        questionId,
      });
    } catch (error) {
      res.status(409).json({ error: String(error) });
    }
  });
};
