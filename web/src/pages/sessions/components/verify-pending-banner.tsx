import type { TResponseVerifyCheckpoint } from '@project-yahl/server/modules/sessions/-api-types';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { resumeVerifyCheckpoint } from '@/pages/sessions/lib/sessions-api';

import { VerifyEditAnswerDialog } from './verify-edit-answer-dialog';

type TVerifyPendingBannerProps = {
  autoRetry?: boolean;
  checkpoint: TResponseVerifyCheckpoint;
  infraBusy?: boolean;
  onDismiss: () => void;
  sessionId: string;
};

export function VerifyPendingBanner({
  autoRetry = false,
  checkpoint,
  infraBusy = false,
  onDismiss,
  sessionId,
}: TVerifyPendingBannerProps) {
  const [resuming, setResuming] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const resume = async () => {
    setResuming(true);

    try {
      await resumeVerifyCheckpoint(sessionId, checkpoint.verifyId);
      onDismiss();
    } finally {
      setResuming(false);
    }
  };

  const isProduceKeys = checkpoint.kind === 'produce_keys';
  const resumeAction = checkpoint.resumeAction ?? 'rerun';
  const showEditAnswer = !autoRetry && !infraBusy && !isProduceKeys && resumeAction === 'edit_answer';
  const showResumeButton = !autoRetry && (infraBusy || (!showEditAnswer && !isProduceKeys));

  const title = isProduceKeys
    ? 'Stage missing required context keys'
    : infraBusy
      ? 'Verification service busy'
      : autoRetry
        ? `Auto-retrying verification (last score ${checkpoint.score.toFixed(2)})`
        : `Stage verification failed (score ${checkpoint.score.toFixed(2)})`;

  return (
    <>
      <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-4">
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{checkpoint.feedback}</p>
        {autoRetry ? (
          <p className="mt-3 text-sm text-muted-foreground">
            The orchestrator is correcting this stage automatically. Do not resume manually while the agent is running.
          </p>
        ) : null}
        {infraBusy ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Verification service could not run. Retry when the nixery verify def is healthy.
          </p>
        ) : null}
        {showEditAnswer ? (
          <Button
            className="mt-3"
            disabled={resuming}
            onClick={() => setEditOpen(true)}
            size="sm"
          >
            Edit answer
          </Button>
        ) : showResumeButton ? (
          <Button
            className="mt-3"
            disabled={resuming}
            onClick={() => void resume()}
            size="sm"
          >
            {resuming
              ? 'Resuming…'
              : infraBusy
                ? 'Retry verification'
                : 'Resume from checkpoint'}
          </Button>
        ) : null}
      </div>

      {showEditAnswer ? (
        <VerifyEditAnswerDialog
          checkpoint={checkpoint}
          onOpenChange={setEditOpen}
          onSubmitted={onDismiss}
          open={editOpen}
          sessionId={sessionId}
        />
      ) : null}
    </>
  );
}
