import type { TResponseVerifyCheckpoint } from '@project-yahl/server/modules/sessions/-api-types';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { resumeVerifyCheckpoint } from '@/pages/sessions/lib/sessions-api';

import { VerifyEditAnswerDialog } from './verify-edit-answer-dialog';

type TVerifyPendingBannerProps = {
  checkpoint: TResponseVerifyCheckpoint;
  onDismiss: () => void;
  sessionId: string;
};

export function VerifyPendingBanner({
  checkpoint,
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
  const showEditAnswer = !isProduceKeys && resumeAction === 'edit_answer';

  return (
    <>
      <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-4">
        <p className="text-sm font-medium">
          {isProduceKeys
            ? 'Stage missing required context keys'
            : `Stage verification failed (score ${checkpoint.score.toFixed(2)})`}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{checkpoint.feedback}</p>
        {showEditAnswer ? (
          <Button
            className="mt-3"
            disabled={resuming}
            onClick={() => setEditOpen(true)}
            size="sm"
          >
            Edit answer
          </Button>
        ) : (
          <Button
            className="mt-3"
            disabled={resuming}
            onClick={() => void resume()}
            size="sm"
          >
            {resuming ? 'Resuming…' : 'Resume from checkpoint'}
          </Button>
        )}
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
