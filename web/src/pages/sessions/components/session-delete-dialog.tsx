import { useState } from "react";
import { useNavigate } from "react-router";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SESSION_SHEET_WIDTH } from "@/pages/sessions/lib/session-sheet";
import { deleteSession } from "@/pages/sessions/lib/sessions-api";
import { publishSessionsSnapshot } from "@/providers/live-provider";
import { removeSessionFromSnapshot } from "@/providers/sessions-cache";

type TSessionDeleteDialogProps = {
  deletedAt?: string;
  navigateAfterDelete?: boolean;
  sessionId: string;
};

export function SessionDeleteDialog({
  deletedAt,
  navigateAfterDelete = false,
  sessionId,
}: TSessionDeleteDialogProps) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async (mode: 'hard' | 'soft') => {
    setSubmitting(true);
    setError(null);

    try {
      await deleteSession(sessionId, mode);
      removeSessionFromSnapshot(sessionId);
      publishSessionsSnapshot();
      setOpen(false);

      if (navigateAfterDelete) {
        navigate('/sessions');
      }
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Delete failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet onOpenChange={setOpen} open={open}>
      <SheetTrigger
        render={
          <Button type="button" variant="destructive">
            Delete
          </Button>
        }
      />
      <SheetContent className={SESSION_SHEET_WIDTH} side="right">
        <SheetHeader>
          <SheetTitle>Delete session</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-6 pb-6">
          <p className="font-mono text-xs text-muted-foreground">{sessionId}</p>
          {deletedAt ? (
            <p className="text-sm text-muted-foreground">
              This session is already soft-deleted. You can permanently remove it with hard delete.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Soft delete hides the session from the list but keeps data. Hard delete permanently
              removes the session and related records.
            </p>
          )}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="flex flex-col gap-2">
            {!deletedAt ? (
              <Button
                disabled={submitting}
                onClick={() => void handleDelete('soft')}
                type="button"
                variant="outline"
              >
                {submitting ? 'Deleting…' : 'Soft delete'}
              </Button>
            ) : null}
            <Button
              disabled={submitting}
              onClick={() => void handleDelete('hard')}
              type="button"
              variant="destructive"
            >
              {submitting ? 'Deleting…' : 'Hard delete'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
