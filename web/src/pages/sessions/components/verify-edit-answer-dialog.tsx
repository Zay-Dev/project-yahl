import type { TResponseVerifyCheckpoint } from '@project-yahl/server/modules/sessions/-api-types';

import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { SESSION_SHEET_WIDTH } from '@/pages/sessions/lib/session-sheet';
import { submitVerifyEditAnswer } from '@/pages/sessions/lib/sessions-api';

const CUSTOM_OPTION_ID = '__custom__';
const EMPTY_OPTIONS: { id: string; label: string }[] = [];

type TAskUserQuestionArgs = {
  description?: string;
  options?: { id: string; label: string }[];
  title?: string;
};

type TVerifyEditAnswerDialogProps = {
  checkpoint: TResponseVerifyCheckpoint;
  onOpenChange: (open: boolean) => void;
  onSubmitted: () => void;
  open: boolean;
  sessionId: string;
};

const _resolvePriorAnswer = (checkpoint: TResponseVerifyCheckpoint) => {
  const askUserRef = checkpoint.askUserRef?.trim();

  if (!askUserRef) {
    return undefined;
  }

  const context = checkpoint.storageSnapshot?.context;

  if (context && typeof context === 'object' && !Array.isArray(context)) {
    const fromContext = (context as Record<string, unknown>)[`ask_user_${askUserRef}_answer`];

    if (fromContext !== undefined && fromContext !== null && fromContext !== '') {
      return fromContext;
    }
  }

  const entry = checkpoint.stage.askUser?.find((item) => item.id === askUserRef);

  return entry?.answer;
};

const _resolveQuestionArgs = (checkpoint: TResponseVerifyCheckpoint) => {
  const fromCheckpoint = checkpoint.askUserQuestion;

  if (fromCheckpoint && typeof fromCheckpoint === 'object' && !Array.isArray(fromCheckpoint)) {
    return fromCheckpoint as TAskUserQuestionArgs;
  }

  return undefined;
};

export function VerifyEditAnswerDialog({
  checkpoint,
  onOpenChange,
  onSubmitted,
  open,
  sessionId,
}: TVerifyEditAnswerDialogProps) {
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [freeText, setFreeText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const askUserRef = checkpoint.askUserRef?.trim() ?? '';
  const entry = useMemo(
    () => checkpoint.stage.askUser?.find((item) => item.id === askUserRef) ?? null,
    [askUserRef, checkpoint.stage.askUser],
  );
  const questionArgs = useMemo(
    () => _resolveQuestionArgs(checkpoint),
    [checkpoint.askUserQuestion],
  );
  const options = useMemo(
    () => questionArgs?.options ?? entry?.options ?? EMPTY_OPTIONS,
    [entry?.options, questionArgs?.options],
  );
  const title = questionArgs?.title?.trim() ?? entry?.question?.trim() ?? 'Edit your answer';

  useEffect(() => {
    if (open) {
      return;
    }

    setSelectedOptionId(null);
    setFreeText('');
    setError(null);
    setSubmitting(false);
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const prior = _resolvePriorAnswer(checkpoint);

    if (prior === undefined || prior === null || prior === '') {
      setSelectedOptionId(null);
      setFreeText('');
      return;
    }

    const priorText = String(prior);
    const matchedOption = options.find((option) => option.id === priorText);

    if (matchedOption) {
      setSelectedOptionId(matchedOption.id);
      setFreeText('');
      return;
    }

    setSelectedOptionId(CUSTOM_OPTION_ID);
    setFreeText(priorText);
  }, [checkpoint.verifyId, open]);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);

    try {
      if (selectedOptionId === CUSTOM_OPTION_ID) {
        const trimmed = freeText.trim();

        if (!trimmed) {
          throw new Error('Enter a custom answer or pick an option.');
        }

        await submitVerifyEditAnswer(sessionId, checkpoint.verifyId, { freeText: trimmed });
      } else if (selectedOptionId) {
        await submitVerifyEditAnswer(sessionId, checkpoint.verifyId, {
          optionIds: [selectedOptionId],
        });
      } else {
        throw new Error('Select an option or enter a custom answer.');
      }

      onSubmitted();
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
          {questionArgs?.description ? (
            <p className="text-sm text-muted-foreground">{questionArgs.description}</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Verification failed because the prior answer did not satisfy the rubric. Update it below.
            </p>
          )}

          <div className="space-y-2">
            {options.map((option) => (
              <label
                className="flex cursor-pointer items-start gap-3 rounded-md border p-3"
                key={option.id}
              >
                <input
                  checked={selectedOptionId === option.id}
                  className="mt-1"
                  name="verify-edit-answer-option"
                  onChange={() => setSelectedOptionId(option.id)}
                  type="radio"
                />
                <span className="text-sm">{option.label}</span>
              </label>
            ))}

            <div className="rounded-md border p-3">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  checked={selectedOptionId === CUSTOM_OPTION_ID}
                  className="mt-1"
                  name="verify-edit-answer-option"
                  onChange={() => setSelectedOptionId(CUSTOM_OPTION_ID)}
                  type="radio"
                />
                <span className="text-sm">Type your own answer</span>
              </label>
              <Input
                className="mt-2"
                onChange={(event) => {
                  setFreeText(event.target.value);
                  setSelectedOptionId(CUSTOM_OPTION_ID);
                }}
                onFocus={() => setSelectedOptionId(CUSTOM_OPTION_ID)}
                placeholder="Custom answer"
                value={freeText}
              />
            </div>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <Button disabled={submitting} onClick={() => void handleSubmit()}>
            {submitting ? 'Submitting…' : 'Save and resume'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
