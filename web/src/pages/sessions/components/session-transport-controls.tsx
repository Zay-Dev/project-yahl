import type {
  TResponseGetSession,
  TResponseUserPauseCheckpoint,
} from '@project-yahl/server/modules/sessions/-api-types';

import { Pause, Play, Square } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { SESSION_SHEET_WIDTH } from '@/pages/sessions/lib/session-sheet';
import {
  pauseSession,
  resumeUserPauseCheckpoint,
  stopSession,
} from '@/pages/sessions/lib/sessions-api';

type TSessionTransportControlsProps = {
  onActionComplete: () => void;
  onPausePendingChange: (pending: boolean) => void;
  onResumePendingChange: (pending: boolean) => void;
  pausePending: boolean;
  pauseWaitError?: string | null;
  pendingUserPause: TResponseUserPauseCheckpoint | null;
  resumePending: boolean;
  resumeWaitError?: string | null;
  session: TResponseGetSession;
  verifyAutoRetry?: boolean;
};

const runStateLabel = (
  runState: TResponseGetSession['runState'],
  resumePending: boolean,
) => {
  if (resumePending) {
    return 'Resuming';
  }

  if (runState === 'active') {
    return 'Running';
  }

  if (runState === 'stuck') {
    return 'Stuck';
  }

  return 'Idle';
};

const runStateClass = (
  runState: TResponseGetSession['runState'],
  resumePending: boolean,
) => {
  if (resumePending || runState === 'active') {
    return 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200';
  }

  if (runState === 'stuck') {
    return 'bg-destructive/15 text-destructive';
  }

  return 'bg-muted text-muted-foreground';
};

export function SessionTransportControls({
  onActionComplete,
  onPausePendingChange,
  onResumePendingChange,
  pausePending,
  pauseWaitError = null,
  pendingUserPause,
  resumePending,
  resumeWaitError = null,
  session,
  verifyAutoRetry = false,
}: TSessionTransportControlsProps) {
  const [stopOpen, setStopOpen] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [pausing, setPausing] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sessionId = session.sessionId;
  const isActive = session.runState === 'active';
  const showPlay = Boolean(pendingUserPause) || resumePending;
  const showPausing = pausing || pausePending;
  const showResuming = playing || resumePending;
  const displayError = error ?? pauseWaitError ?? resumeWaitError;

  const handleStop = async () => {
    setStopping(true);
    setError(null);

    try {
      await stopSession(sessionId);
      setStopOpen(false);
      onPausePendingChange(false);
      onResumePendingChange(false);
      onActionComplete();
    } catch (stopError) {
      setError(stopError instanceof Error ? stopError.message : 'Stop failed');
    } finally {
      setStopping(false);
    }
  };

  const handlePause = async () => {
    setPausing(true);
    setError(null);

    try {
      await pauseSession(sessionId);
      onPausePendingChange(true);
    } catch (pauseError) {
      setError(pauseError instanceof Error ? pauseError.message : 'Pause failed');
      onPausePendingChange(false);
    } finally {
      setPausing(false);
    }
  };

  const handlePlay = async () => {
    if (!pendingUserPause) {
      return;
    }

    setPlaying(true);
    setError(null);

    try {
      await resumeUserPauseCheckpoint(sessionId, pendingUserPause.pauseId);
      onResumePendingChange(true);
    } catch (playError) {
      setError(playError instanceof Error ? playError.message : 'Resume failed');
      onResumePendingChange(false);
    } finally {
      setPlaying(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className={`rounded px-2 py-0.5 text-xs font-medium ${runStateClass(session.runState, resumePending)}`}
      >
        {runStateLabel(session.runState, resumePending)}
      </span>
      {isActive ? (
        <>
          <Button
            disabled={showPausing || verifyAutoRetry}
            onClick={() => void handlePause()}
            size="sm"
            type="button"
            variant="outline"
          >
            <Pause className="size-3.5" />
            {showPausing ? 'Pausing…' : 'Pause'}
          </Button>
          <Sheet onOpenChange={setStopOpen} open={stopOpen}>
            <SheetTrigger
              render={
                <Button
                  disabled={showPausing || stopping}
                  size="sm"
                  type="button"
                  variant="destructive"
                >
                  <Square className="size-3.5" />
                  Stop
                </Button>
              }
            />
            <SheetContent className={SESSION_SHEET_WIDTH} side="right">
              <SheetHeader>
                <SheetTitle>Stop session run</SheetTitle>
              </SheetHeader>
              <div className="flex flex-col gap-4 px-6 pb-6">
                <p className="text-sm text-muted-foreground">
                  This immediately kills the orchestrator and tears down the agent container.
                  Open stages may remain marked as in progress.
                </p>
                {displayError ? <p className="text-sm text-destructive">{displayError}</p> : null}
                <Button
                  disabled={stopping}
                  onClick={() => void handleStop()}
                  type="button"
                  variant="destructive"
                >
                  {stopping ? 'Stopping…' : 'Confirm stop'}
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </>
      ) : null}
      {showPlay ? (
        <Button
          disabled={showResuming}
          onClick={() => void handlePlay()}
          size="sm"
          type="button"
        >
          <Play className="size-3.5" />
          {showResuming ? 'Resuming…' : 'Resume'}
        </Button>
      ) : null}
      {displayError && !stopOpen ? (
        <p className="text-xs text-destructive">{displayError}</p>
      ) : null}
    </div>
  );
}
