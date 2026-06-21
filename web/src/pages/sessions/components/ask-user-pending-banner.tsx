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
  const batchTitle = first.batch?.title?.trim() || first.title?.trim() || 'Answer required';
  const questionCount = first.questionCount ?? first.batch?.questions?.length ?? 1;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-medium">Waiting for your answer</p>
        <p className="text-sm text-muted-foreground">
          {questionCount > 1
            ? `${batchTitle} (${questionCount} questions)`
            : batchTitle}
        </p>
      </div>
      <Button onClick={() => onOpenQuestion(first)} variant="default">
        {questionCount > 1 ? 'Answer questions' : 'Answer question'}
      </Button>
    </div>
  );
}
