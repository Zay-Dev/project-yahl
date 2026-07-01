import type { TResponseAskUserQuestionListItem } from "@project-yahl/server/modules/sessions/-api-types";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { SESSION_SHEET_WIDTH } from "@/pages/sessions/lib/session-sheet";
import {
  fetchAskUserQuestion,
  submitAskUserBatchAnswer,
} from "@/pages/sessions/lib/sessions-api";

type TBatchQuestion = NonNullable<
  NonNullable<TResponseAskUserQuestionListItem['batch']>['questions']
>[number];

type TQuestionAnswerState = {
  freeText?: string;
  mode: 'custom' | 'preset';
  optionIds: string[];
};

type TAskUserQuestionDialogProps = {
  onAnswered: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  question: TResponseAskUserQuestionListItem | null;
  sessionId: string;
};

const _isAnswerComplete = (
  question: TBatchQuestion,
  state: TQuestionAnswerState | undefined,
) => {
  if (!state) return false;

  if (question.kind === 'text') {
    return Boolean(state.freeText?.trim());
  }

  if (state.mode === 'custom') {
    return Boolean(state.freeText?.trim());
  }

  if (question.allowMultiple) {
    const minChoices = question.minChoices ?? 1;

    return state.optionIds.length >= minChoices;
  }

  return state.optionIds.length === 1;
};

export function AskUserQuestionDialog({
  onAnswered,
  onOpenChange,
  open,
  question,
  sessionId,
}: TAskUserQuestionDialogProps) {
  const [batch, setBatch] = useState<TResponseAskUserQuestionListItem['batch']>();
  const [answers, setAnswers] = useState<Record<string, TQuestionAnswerState>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const questions = useMemo(() => batch?.questions ?? [], [batch]);
  const title = batch?.title?.trim() || question?.title?.trim() || 'Answer required';
  const allAnswered = questions.every((item) => _isAnswerComplete(item, answers[item.questionRef]));

  useEffect(() => {
    if (!open || !question) {
      setBatch(undefined);
      setAnswers({});
      setError(null);
      setSubmitting(false);
      return;
    }

    let cancelled = false;

    void fetchAskUserQuestion(sessionId, question.questionId)
      .then((detail) => {
        if (cancelled) return;

        setBatch(detail.batch ?? question.batch);
        setAnswers({});
      })
      .catch((loadError) => {
        if (cancelled) return;

        setError(loadError instanceof Error ? loadError.message : 'Failed to load questions');
      });

    return () => {
      cancelled = true;
    };
  }, [open, question, sessionId]);

  const updateAnswer = (questionRef: string, next: TQuestionAnswerState) => {
    setAnswers((current) => ({
      ...current,
      [questionRef]: next,
    }));
  };

  const handleSubmit = async () => {
    if (!question?.batchId || !allAnswered) return;

    setSubmitting(true);
    setError(null);

    try {
      const payload = questions.map((item) => {
        const state = answers[item.questionRef]!;

        if (item.kind === 'text' || state.mode === 'custom') {
          return {
            freeText: state.freeText?.trim(),
            questionRef: item.questionRef,
          };
        }

        return {
          optionIds: state.optionIds,
          questionRef: item.questionRef,
        };
      });

      await submitAskUserBatchAnswer(sessionId, question.batchId, payload);
      onAnswered();
      onOpenChange(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to submit answers');
    } finally {
      setSubmitting(false);
    }
  };

  const renderQuestion = (item: TBatchQuestion) => {
    const state = answers[item.questionRef] ?? {
      mode: 'preset' as const,
      optionIds: [],
    };

    if (item.kind === 'text') {
      return (
        <div className="space-y-2 rounded-md border p-4" key={item.questionRef}>
          <p className="text-sm font-medium">{item.title}</p>
          {item.description ? (
            <p className="text-sm text-muted-foreground">{item.description}</p>
          ) : null}
          <Textarea
            onChange={(event: ChangeEvent<HTMLTextAreaElement>) => updateAnswer(item.questionRef, {
              freeText: event.target.value,
              mode: 'custom',
              optionIds: [],
            })}
            placeholder={item.placeholder ?? 'Your answer'}
            value={state.freeText ?? ''}
          />
        </div>
      );
    }

    const options = item.options ?? [];
    const isCheckbox = Boolean(item.allowMultiple);

    return (
      <div className="space-y-2 rounded-md border p-4" key={item.questionRef}>
        <p className="text-sm font-medium">{item.title}</p>
        {item.description ? (
          <p className="text-sm text-muted-foreground">{item.description}</p>
        ) : null}

        <div className="space-y-2">
          {options.map((option) => (
            <label
              className="flex cursor-pointer items-start gap-3 rounded-md border p-3"
              key={option.id}
            >
              <input
                checked={isCheckbox
                  ? state.mode === 'preset' && state.optionIds.includes(option.id)
                  : state.mode === 'preset' && state.optionIds[0] === option.id}
                className="mt-1"
                name={`ask-user-${item.questionRef}`}
                onChange={() => {
                  if (isCheckbox) {
                    const nextIds = state.optionIds.includes(option.id)
                      ? state.optionIds.filter((id) => id !== option.id)
                      : [...state.optionIds, option.id];

                    updateAnswer(item.questionRef, {
                      mode: 'preset',
                      optionIds: nextIds,
                    });
                    return;
                  }

                  updateAnswer(item.questionRef, {
                    mode: 'preset',
                    optionIds: [option.id],
                  });
                }}
                type={isCheckbox ? 'checkbox' : 'radio'}
              />
              <span className="text-sm">{option.label}</span>
            </label>
          ))}

          <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3">
            <input
              checked={state.mode === 'custom'}
              className="mt-1"
              name={`ask-user-${item.questionRef}`}
              onChange={() => updateAnswer(item.questionRef, {
                freeText: state.freeText ?? '',
                mode: 'custom',
                optionIds: [],
              })}
              type="radio"
            />
            <div className="flex w-full flex-col gap-2">
              <span className="text-sm">Type your own answer</span>
              <Input
                onChange={(event) => updateAnswer(item.questionRef, {
                  freeText: event.target.value,
                  mode: 'custom',
                  optionIds: [],
                })}
                onFocus={() => updateAnswer(item.questionRef, {
                  freeText: state.freeText ?? '',
                  mode: 'custom',
                  optionIds: [],
                })}
                placeholder="Custom answer"
                value={state.mode === 'custom' ? state.freeText ?? '' : ''}
              />
            </div>
          </label>
        </div>
      </div>
    );
  };

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className={`${SESSION_SHEET_WIDTH} gap-0`} side="right">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 pb-6">
          {batch?.description ? (
            <p className="text-sm text-muted-foreground">{batch.description}</p>
          ) : null}

          {questions.map(renderQuestion)}

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <Button
            disabled={submitting || !question || !allAnswered}
            onClick={() => void handleSubmit()}
          >
            {submitting ? 'Submitting…' : `Submit ${questions.length} answer${questions.length === 1 ? '' : 's'}`}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
