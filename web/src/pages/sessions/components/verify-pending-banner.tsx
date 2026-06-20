import { useEffect, useState } from 'react';

import type { TSessionLiveEvent } from '@project-yahl/server/modules/sessions/-api-types';

import { Button } from '@/components/ui/button';

const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

type TCheckpoint = {
  feedback: string;
  kind?: 'produce_keys' | 'verify';
  score: number;
  status: string;
  verifyId: string;
};

export function VerifyPendingBanner(props: {
  lastEvent: TSessionLiveEvent | null;
  sessionId: string;
}) {
  const [checkpoint, setCheckpoint] = useState<TCheckpoint | null>(null);
  const verifyId = props.lastEvent?.type === 'verify.failed'
    || props.lastEvent?.type === 'produce_keys.failed'
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
        data?: TCheckpoint;
        feedback?: string;
        kind?: TCheckpoint['kind'];
        score?: number;
        status?: string;
        verifyId?: string;
      };

      const loaded = data.data ?? (data.verifyId ? data as TCheckpoint : null);

      setCheckpoint(loaded);
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

  const isProduceKeys = checkpoint.kind === 'produce_keys';

  return (
    <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-4">
      <p className="text-sm font-medium">
        {isProduceKeys
          ? 'Stage missing required context keys'
          : `Stage verification failed (score ${checkpoint.score.toFixed(2)})`}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{checkpoint.feedback}</p>
      <Button className="mt-3" onClick={() => void resume()} size="sm">Resume from checkpoint</Button>
    </div>
  );
}
