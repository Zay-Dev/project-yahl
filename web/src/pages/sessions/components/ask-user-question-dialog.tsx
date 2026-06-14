import type { TResponseAskUserQuestionListItem } from "@project-yahl/server/modules/sessions/-api-types";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { SESSION_SHEET_WIDTH } from "@/pages/sessions/lib/session-sheet";
import { submitAskUserAnswer } from "@/pages/sessions/lib/sessions-api";

type TAskUserQuestion = TResponseAskUserQuestionListItem & {
  question: {
    description?: string;
    options?: { id: string; label: string }[];
    title?: string;
  };
};

type TAskUserQuestionDialogProps = {
  onAnswered: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  question: TAskUserQuestion | null;
  sessionId: string;
};

const CUSTOM_OPTION_ID = '__custom__';

export function AskUserQuestionDialog({
  onAnswered,
  onOpenChange,
  open,
  question,
  sessionId,
}: TAskUserQuestionDialogProps) {
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [freeText, setFreeText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options = useMemo(
    () => question?.question.options ?? [],
    [question],
  );

  const title = question?.question.title?.trim() || 'Answer required';

  useEffect(() => {
    if (!open) {
      setSelectedOptionId(null);
      setFreeText('');
      setError(null);
      setSubmitting(false);
    }
  }, [open, question?.questionId]);

  const handleSubmit = async () => {
    if (!question) return;

    setSubmitting(true);
    setError(null);

    try {
      if (selectedOptionId === CUSTOM_OPTION_ID) {
        const trimmed = freeText.trim();

        if (!trimmed) {
          throw new Error('Enter a custom answer or pick an option.');
        }

        await submitAskUserAnswer(sessionId, question.questionId, { freeText: trimmed });
      } else if (selectedOptionId) {
        await submitAskUserAnswer(sessionId, question.questionId, {
          optionIds: [selectedOptionId],
        });
      } else {
        throw new Error('Select an option or enter a custom answer.');
      }

      onAnswered();
      onOpenChange(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to submit answer');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className={`${SESSION_SHEET_WIDTH} gap-0`} side="right">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 pb-6">
          {question?.question.description ? (
            <p className="text-sm text-muted-foreground">{question.question.description}</p>
          ) : null}

          <div className="space-y-2">
            {options.map((option) => (
              <label
                className="flex cursor-pointer items-start gap-3 rounded-md border p-3"
                key={option.id}
              >
                <input
                  checked={selectedOptionId === option.id}
                  className="mt-1"
                  name="ask-user-option"
                  onChange={() => setSelectedOptionId(option.id)}
                  type="radio"
                />
                <span className="text-sm">{option.label}</span>
              </label>
            ))}

            <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3">
              <input
                checked={selectedOptionId === CUSTOM_OPTION_ID}
                className="mt-1"
                name="ask-user-option"
                onChange={() => setSelectedOptionId(CUSTOM_OPTION_ID)}
                type="radio"
              />
              <div className="flex w-full flex-col gap-2">
                <span className="text-sm">Type your own answer</span>
                <Input
                  onChange={(event) => {
                    setFreeText(event.target.value);
                    setSelectedOptionId(CUSTOM_OPTION_ID);
                  }}
                  onFocus={() => setSelectedOptionId(CUSTOM_OPTION_ID)}
                  placeholder="Custom answer"
                  value={freeText}
                />
              </div>
            </label>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <Button disabled={submitting || !question} onClick={() => void handleSubmit()}>
            {submitting ? 'Submitting…' : 'Submit answer'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
