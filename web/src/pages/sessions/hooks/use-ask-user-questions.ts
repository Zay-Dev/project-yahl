import type {
  TResponseAskUserQuestionListItem,
  TSessionLiveEvent,
} from "@project-yahl/server/modules/sessions/-api-types";

import { useCallback, useEffect, useState } from "react";

import { fetchPendingAskUserQuestions } from "@/pages/sessions/lib/sessions-api";

type TUseAskUserQuestionsParams = {
  lastEvent: TSessionLiveEvent | null;
  sessionId: string;
};

export const useAskUserQuestions = ({
  lastEvent,
  sessionId,
}: TUseAskUserQuestionsParams) => {
  const [pendingQuestions, setPendingQuestions] = useState<TResponseAskUserQuestionListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeQuestion, setActiveQuestion] = useState<TResponseAskUserQuestionListItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const refetch = useCallback(async () => {
    if (!sessionId) return;

    try {
      const items = await fetchPendingAskUserQuestions(sessionId);
      setPendingQuestions(items);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load questions');
    }
  }, [sessionId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  useEffect(() => {
    if (!lastEvent) return;

    if (lastEvent.type === 'ask-user.created' || lastEvent.type === 'ask-user.answered') {
      void refetch();
    }
  }, [lastEvent, refetch]);

  useEffect(() => {
    if (lastEvent?.type !== 'ask-user.created') return;

    const match = pendingQuestions.find((item) => item.questionId === lastEvent.questionId);

    if (match) {
      setActiveQuestion(match);
      setDialogOpen(true);
    }
  }, [lastEvent, pendingQuestions]);

  const openQuestion = (question: TResponseAskUserQuestionListItem) => {
    setActiveQuestion(question);
    setDialogOpen(true);
  };

  const handleAnswered = () => {
    void refetch();
  };

  return {
    activeQuestion,
    dialogOpen,
    error,
    handleAnswered,
    openQuestion,
    pendingQuestions,
    setDialogOpen,
  };
};
