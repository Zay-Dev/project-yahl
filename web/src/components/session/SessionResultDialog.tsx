import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { buildA2uiPreviewModels } from "@/lib/a2ui-v08-preview";
import { stringifyValue } from "@/lib/format";
import type { SessionDetail } from "@/types";

import { A2uiV08Preview } from "./A2uiV08Preview";

type Props = {
  detail: SessionDetail | null;
  onClose: () => void;
  open: boolean;
};

type A2uiResultView = "preview" | "raw";

export const SessionResultDialog = ({ detail, onClose, open }: Props) => {
  const [a2uiView, setA2uiView] = useState<A2uiResultView>("preview");
  const hasA2ui = detail?.resultA2ui !== undefined && detail?.resultA2ui !== null;
  const a2uiPreviewModels = useMemo(
    () => (hasA2ui ? buildA2uiPreviewModels(detail.resultA2ui) : []),
    [detail?.resultA2ui, hasA2ui],
  );
  const canPreviewA2ui = a2uiPreviewModels.some((entry) => !entry.model.diagnostics.missingRoot);

  useEffect(() => {
    if (open) setA2uiView("preview");
  }, [open]);

  return (
    <Dialog onOpenChange={(next) => !next && onClose()} open={open}>
      <DialogContent className="flex max-h-[90vh] w-full flex-col gap-4 sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Session result</DialogTitle>
          {detail?.sessionId ? (
            <DialogDescription className="font-mono text-xs">{detail.sessionId}</DialogDescription>
          ) : null}
        </DialogHeader>

        <div className="grid max-h-[70vh] gap-3 overflow-auto">
          <pre className="rounded-md border p-3 text-xs">
            {stringifyValue((detail?.result as { raw?: unknown; ui?: unknown } | undefined)?.raw ?? detail?.result)}
          </pre>

          {(detail?.result as { ui?: unknown } | undefined)?.ui !== undefined ? (
            <pre className="rounded-md border p-3 text-xs">
              {stringifyValue((detail?.result as { ui?: unknown }).ui)}
            </pre>
          ) : null}

          {hasA2ui ? (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Session A2UI (v0.8)</p>
                <div className="flex gap-1">
                  <Button
                    disabled={!canPreviewA2ui}
                    onClick={() => setA2uiView("preview")}
                    size="xs"
                    type="button"
                    variant={a2uiView === "preview" ? "default" : "outline"}
                  >
                    Preview
                  </Button>
                  <Button
                    onClick={() => setA2uiView("raw")}
                    size="xs"
                    type="button"
                    variant={a2uiView === "raw" ? "default" : "outline"}
                  >
                    Raw JSON
                  </Button>
                </div>
              </div>
              {a2uiPreviewModels.length ? (
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Parsed {a2uiPreviewModels.length} surface{a2uiPreviewModels.length > 1 ? "s" : ""}.
                </p>
              ) : null}
              {a2uiView === "preview" && canPreviewA2ui ? (
                <div className="space-y-3">
                  {a2uiPreviewModels.map(({ model, surfaceId }) => (
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
              {a2uiView === "preview" && !canPreviewA2ui ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Preview unavailable for this payload.
                </p>
              ) : null}
              {a2uiView === "raw" ? (
                <pre className="rounded-md border p-3 text-xs">
                  {stringifyValue(detail.resultA2ui)}
                </pre>
              ) : null}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
};
