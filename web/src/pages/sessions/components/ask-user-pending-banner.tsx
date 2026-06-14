import type { TResponseAskUserQuestionListItem } from "@project-yahl/server/modules/sessions/-api-types";

import { Button } from "@/components/ui/button";

type TAskUserPendingBannerProps = {
  onOpenQuestion: (question: TResponseAskUserQuestionListItem) => void;
  questions: TResponseAskUserQuestionListItem[];
};

export function AskUserPendingBanner({
  onOpenQuestion,
  questions,
}: TAskUserPendingBannerProps) {
  if (questions.length === 0) {
    return null;
  }

  const first = questions[0]!;
  const questionTitle = (first.question as { title?: string }).title?.trim() || 'Answer required';

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-medium">Waiting for your answer</p>
        <p className="text-sm text-muted-foreground">
          {questions.length === 1
            ? questionTitle
            : `${questions.length} pending questions`}
        </p>
      </div>
      <Button onClick={() => onOpenQuestion(first)} variant="default">
        Answer question
      </Button>
    </div>
  );
}
