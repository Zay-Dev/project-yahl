import { useMemo, useState } from "react";

import { answerAskUserQuestion } from "@/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AskUserQuestion } from "@/types";

type Props = {
  onAnswered: () => void | Promise<void>;
  questions: AskUserQuestion[];
  sessionId: string;
};

export const AskUserPanel = ({ onAnswered, questions, sessionId }: Props) => {
  const pending = useMemo(() => questions.filter((question) => question.status === "pending"), [questions]);
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [savingQuestionId, setSavingQuestionId] = useState<string | null>(null);

  if (!questions.length) return null;

  const toggle = (question: AskUserQuestion, optionId: string) => {
    setSelected((prev) => {
      const current = prev[question.questionId] || [];
      if (question.allowMultiple) {
        const next = current.includes(optionId)
          ? current.filter((id) => id !== optionId)
          : [...current, optionId];
        return { ...prev, [question.questionId]: next };
      }
      return { ...prev, [question.questionId]: [optionId] };
    });
  };

  const submit = async (question: AskUserQuestion) => {
    const answerIds = selected[question.questionId] || [];
    if (!answerIds.length) return;
    setSavingQuestionId(question.questionId);
    try {
      await answerAskUserQuestion(sessionId, question.questionId, answerIds);
      await onAnswered();
    } finally {
      setSavingQuestionId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ask-user queue</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {pending.length ? (
          pending.map((question) => {
            const picked = selected[question.questionId] || [];
            return (
              <div className="rounded-md border p-3" key={question.questionId}>
                <div className="mb-2 flex items-center gap-2">
                  <h4 className="text-sm font-medium">{question.title}</h4>
                  <Badge variant="outline">pending</Badge>
                </div>
                {question.description ? (
                  <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">{question.description}</p>
                ) : null}
                <div className="mb-3 flex flex-wrap gap-2">
                  {question.options.map((option) => {
                    const isActive = picked.includes(option.id);
                    return (
                      <Button
                        key={option.id}
                        onClick={() => toggle(question, option.id)}
                        size="sm"
                        variant={isActive ? "default" : "outline"}
                      >
                        {option.label}
                      </Button>
                    );
                  })}
                </div>
                <Button
                  disabled={!picked.length || savingQuestionId === question.questionId}
                  onClick={() => void submit(question)}
                  size="sm"
                >
                  Submit answer
                </Button>
              </div>
            );
          })
        ) : (
          <p className="text-xs text-slate-500 dark:text-slate-400">No pending questions.</p>
        )}
      </CardContent>
    </Card>
  );
};
