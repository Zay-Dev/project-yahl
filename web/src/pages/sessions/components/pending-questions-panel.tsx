import type { TResponsePendingAskUserQuestion } from "@project-yahl/server/modules/sessions/-api-types";

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";

import { Button } from "@/components/ui/button";
import { AskUserQuestionDialog } from "@/pages/sessions/components/ask-user-question-dialog";
import {
  fetchAllPendingAskUserQuestions,
} from "@/pages/sessions/lib/sessions-api";

type TPendingQuestionsPanelProps = {
  compact?: boolean;
};

export const PendingQuestionsPanel = ({ compact = false }: TPendingQuestionsPanelProps) => {
  const [items, setItems] = useState<TResponsePendingAskUserQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<TResponsePendingAskUserQuestion | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const pending = await fetchAllPendingAskUserQuestions();
      setItems(pending);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load pending questions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const openQuestion = (item: TResponsePendingAskUserQuestion) => {
    setActive(item);
    setDialogOpen(true);
  };

  return (
    <div className={compact ? "flex flex-col gap-3" : "flex flex-1 flex-col gap-6"}>
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className={compact ? "text-lg font-semibold tracking-tight" : "text-2xl font-semibold tracking-tight"}>
            Pending questions
          </h2>
          <p className="text-muted-foreground text-sm">
            Sessions paused on ask-user checkpoints across knowledge refresh runs.
          </p>
        </div>
        <Button onClick={() => void reload()} type="button" variant="outline">
          Refresh
        </Button>
      </div>

      {error ? (
        <p className="text-destructive text-sm">{error}</p>
      ) : null}

      {loading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-muted-foreground text-sm">No pending questions.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-3 text-left font-medium">Task</th>
                <th className="p-3 text-left font-medium">Session</th>
                <th className="p-3 text-left font-medium">Title</th>
                <th className="p-3 text-left font-medium">Questions</th>
                <th className="p-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr className="border-t" key={item.questionId}>
                  <td className="p-3">{item.taskId ?? "—"}</td>
                  <td className="p-3">
                    <Link className="underline" to={`/sessions/${encodeURIComponent(item.sessionId)}`}>
                      {item.sessionId}
                    </Link>
                  </td>
                  <td className="p-3">{item.title ?? item.batchId ?? "Ask user"}</td>
                  <td className="p-3">
                    <span className="rounded-md bg-secondary px-2 py-0.5 text-xs">
                      {item.questionCount ?? 1}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <Button onClick={() => openQuestion(item)} size="sm" type="button">
                      Answer
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {active ? (
        <AskUserQuestionDialog
          onAnswered={() => {
            setDialogOpen(false);
            setActive(null);
            void reload();
          }}
          onOpenChange={setDialogOpen}
          open={dialogOpen}
          question={active}
          sessionId={active.sessionId}
        />
      ) : null}
    </div>
  );
};
