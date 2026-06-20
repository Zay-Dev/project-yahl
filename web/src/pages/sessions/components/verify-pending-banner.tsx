import { useCallback, useEffect, useState } from 'react';

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

const isVerifyFailedEvent = (event: TSessionLiveEvent | null) =>
  event?.type === 'verify.failed' || event?.type === 'produce_keys.failed';

const isVerifyResumedEvent = (event: TSessionLiveEvent | null) =>
  event?.type === 'verify.resumed' || event?.type === 'produce_keys.resumed';

export function VerifyPendingBanner(props: {
  lastEvent: TSessionLiveEvent | null;
  sessionId: string;
}) {
  const [checkpoint, setCheckpoint] = useState<TCheckpoint | null>(null);
  const [activeVerifyId, setActiveVerifyId] = useState<string | undefined>();
  const [resuming, setResuming] = useState(false);

  const loadCheckpoint = useCallback(async (verifyId: string) => {
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

    if (loaded?.status === 'pending') {
      setCheckpoint(loaded);
      return;
    }

    setCheckpoint(null);
  }, [props.sessionId]);

  useEffect(() => {
    const event = props.lastEvent;

    if (!event) {
      return;
    }

    if (isVerifyFailedEvent(event)) {
      setActiveVerifyId(event.verifyId);
    }

    if (isVerifyResumedEvent(event)) {
      setCheckpoint((current) => (
        current?.verifyId === event.verifyId ? null : current
      ));
      setActiveVerifyId((current) => (
        current === event.verifyId ? undefined : current
      ));
    }
  }, [props.lastEvent]);

  useEffect(() => {
    if (!activeVerifyId) {
      return;
    }

    void loadCheckpoint(activeVerifyId);
  }, [activeVerifyId, loadCheckpoint]);

  if (!checkpoint || checkpoint.status !== 'pending') {
    return null;
  }

  const resume = async () => {
    setResuming(true);

    try {
      const res = await fetch(
        `${apiBase}/api/sessions/${encodeURIComponent(props.sessionId)}/verify-checkpoints/${encodeURIComponent(checkpoint.verifyId)}/resume`,
        { method: 'POST' },
      );

      if (!res.ok) {
        throw new Error(`Resume failed (${res.status})`);
      }

      setCheckpoint(null);
    } finally {
      setResuming(false);
    }
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
      <Button
        className="mt-3"
        disabled={resuming}
        onClick={() => void resume()}
        size="sm"
      >
        {resuming ? 'Resuming…' : 'Resume from checkpoint'}
      </Button>
    </div>
  );
};
