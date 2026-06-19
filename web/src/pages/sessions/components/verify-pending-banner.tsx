import { useEffect, useState } from 'react';

import type { TSessionLiveEvent } from '@project-yahl/server/modules/sessions/-api-types';

import { Button } from '@/components/ui/button';

const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

type TVerifyCheckpoint = {
  feedback: string;
  score: number;
  status: string;
  verifyId: string;
};

export function VerifyPendingBanner(props: {
  lastEvent: TSessionLiveEvent | null;
  sessionId: string;
}) {
  const [checkpoint, setCheckpoint] = useState<TVerifyCheckpoint | null>(null);
  const verifyId = props.lastEvent?.type === 'verify.failed'
    ? props.lastEvent.verifyId
    : undefined;

  useEffect(() => {
    if (!verifyId) {
      return;
    }

    const load = async () => {
      const res = await fetch(
        `${apiBase}/api/sessions/${encodeURIComponent(props.sessionId)}/verify-checkpoints/${encodeURIComponent(verifyId)}`,
      );

      if (!res.ok) {
        return;
      }

      const data = await res.json() as {
        data?: TVerifyCheckpoint;
        feedback?: string;
        score?: number;
        status?: string;
        verifyId?: string;
      };

      const checkpoint = data.data ?? (data.verifyId ? data as TVerifyCheckpoint : null);

      setCheckpoint(checkpoint);
    };

    void load();
  }, [props.sessionId, verifyId]);

  if (!checkpoint || checkpoint.status !== 'pending') {
    return null;
  }

  const resume = async () => {
    await fetch(
      `${apiBase}/api/sessions/${encodeURIComponent(props.sessionId)}/verify-checkpoints/${encodeURIComponent(checkpoint.verifyId)}/resume`,
      { method: 'POST' },
    );
  };

  return (
    <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-4">
      <p className="text-sm font-medium">Stage verification failed (score {checkpoint.score.toFixed(2)})</p>
      <p className="mt-1 text-sm text-muted-foreground">{checkpoint.feedback}</p>
      <Button className="mt-3" onClick={() => void resume()} size="sm">Resume from checkpoint</Button>
    </div>
  );
}
