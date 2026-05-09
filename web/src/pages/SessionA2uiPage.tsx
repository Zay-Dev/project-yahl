import { useMemo } from "react";
import { useParams } from "react-router-dom";

import { A2uiV08Preview } from "@/components/session/A2uiV08Preview";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSessionDetail } from "@/hooks/useSessionDetail";
import { buildA2uiPreviewModels } from "@/lib/a2ui-v08-preview";
import { stringifyValue } from "@/lib/format";

export const SessionA2uiPage = () => {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId ?? null;
  const { detail, error, loading } = useSessionDetail(sessionId);
  const hasA2ui = detail?.resultA2ui !== undefined && detail?.resultA2ui !== null;
  const previews = useMemo(
    () => (hasA2ui ? buildA2uiPreviewModels(detail.resultA2ui) : []),
    [detail?.resultA2ui, hasA2ui],
  );
  const canPreview = previews.some((entry) => !entry.model.diagnostics.missingRoot);

  if (!sessionId) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-slate-500 dark:text-slate-400">
          No session selected.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>A2UI result</CardTitle>
            <p className="font-mono text-xs text-slate-500 dark:text-slate-400">{sessionId}</p>
          </div>
          <Button asChild size="sm" variant="outline">
            <a href={`/sessions/${sessionId}`}>Back to session</a>
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Loading session...</p>
          ) : null}
          {error ? (
            <p className="text-sm text-red-500">{error}</p>
          ) : null}
          {!loading && !error && !hasA2ui ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              This session has no persisted A2UI result.
            </p>
          ) : null}
          {hasA2ui && previews.length ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Parsed {previews.length} surface{previews.length > 1 ? "s" : ""}.
            </p>
          ) : null}
          {hasA2ui && canPreview ? (
            <div className="space-y-3">
              {previews.map(({ model, surfaceId }) => (
                <div className="space-y-2 rounded-md border p-3" key={surfaceId}>
                  <p className="font-mono text-xs text-slate-500 dark:text-slate-400">{surfaceId}</p>
                  {model.diagnostics.missingRoot ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Preview unavailable: no renderable root container found.
                    </p>
                  ) : (
                    <A2uiV08Preview model={model} />
                  )}
                </div>
              ))}
            </div>
          ) : null}
          {hasA2ui && !canPreview ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Preview unavailable for this payload.
            </p>
          ) : null}
          {hasA2ui ? (
            <pre className="rounded-md border p-3 text-xs">{stringifyValue(detail?.resultA2ui)}</pre>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
};
