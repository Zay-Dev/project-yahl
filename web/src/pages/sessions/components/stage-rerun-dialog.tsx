import type {
  TRequestCreateForkSessionBody,
  TResponseStageDetail,
  TResponseStageListItem,
} from "@project-yahl/server/modules/sessions/-api-types";
import type { TStageLoopMeta, TYahlStage } from "@project-yahl/server/modules/sessions/-types";

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { CONTEXT_BUCKETS } from "@/pages/sessions/lib/context-diff";
import { filterLaterStagesForRerun } from "@/pages/sessions/lib/rerun-later-stages";
import { createForkSession, fetchSessionStageDetail } from "@/pages/sessions/lib/sessions-api";
import { buildStageLabels } from "@/pages/sessions/lib/stage-label";

type TStageRerunDialogProps = {
  detail: TResponseStageDetail;
  sessionId: string;
  stages: TResponseStageListItem[];
};

const parseJsonField = (label: string, raw: string) => {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new Error(`Invalid JSON in ${label}`);
  }
};

export function StageRerunDialog({ detail, sessionId, stages }: TStageRerunDialogProps) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contextJson, setContextJson] = useState(() => JSON.stringify(detail.context, null, 2));
  const [stageJson, setStageJson] = useState(() => JSON.stringify(detail.stage, null, 2));
  const [loopMetaJson, setLoopMetaJson] = useState(
    () => (detail.loopMeta ? JSON.stringify(detail.loopMeta, null, 2) : ''),
  );
  const [selectedLaterIds, setSelectedLaterIds] = useState<Set<string>>(() => new Set());
  const [laterStageJson, setLaterStageJson] = useState<Map<string, string>>(() => new Map());

  const laterCandidates = useMemo(
    () => filterLaterStagesForRerun(stages, detail),
    [detail, stages],
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    setSelectedLaterIds(new Set(laterCandidates.map((item) => item.stageId)));
  }, [laterCandidates, open]);

  const stageLabels = useMemo(() => buildStageLabels(stages), [stages]);
  const labelByRequestId = useMemo(() => {
    const map = new Map<string, string>();

    stages.forEach((item, index) => {
      map.set(item.requestId, stageLabels[index] ?? `#${index + 1}`);
    });

    return map;
  }, [stageLabels, stages]);

  const toggleLater = (stageId: string, checked: boolean) => {
    setSelectedLaterIds((current) => {
      const next = new Set(current);

      if (checked) {
        next.add(stageId);
      } else {
        next.delete(stageId);
      }

      return next;
    });
  };

  const loadLaterStageJson = async (item: TResponseStageListItem) => {
    if (laterStageJson.has(item.stageId)) {
      return;
    }

    const loaded = await fetchSessionStageDetail(sessionId, item.requestId);

    setLaterStageJson((current) => new Map(current).set(
      item.stageId,
      JSON.stringify(loaded.stage, null, 2),
    ));
  };

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);

    try {
      const context = parseJsonField('context', contextJson) as Record<string, unknown>;
      const stage = parseJsonField('stage setup', stageJson) as TYahlStage;
      const loopMeta = loopMetaJson.trim()
        ? parseJsonField('loop meta', loopMetaJson) as TStageLoopMeta
        : undefined;

      const anchorSetup = {
        context,
        loopMeta,
        stage,
        stageId: detail.stageId,
      };

      const laterSetups: TRequestCreateForkSessionBody['setups'] = [];

      for (const item of laterCandidates) {
        if (!selectedLaterIds.has(item.stageId)) {
          continue;
        }

        const raw = laterStageJson.get(item.stageId);

        if (!raw) {
          throw new Error(`Stage ${labelByRequestId.get(item.requestId) ?? item.stageId} is not loaded`);
        }

        const loaded = await fetchSessionStageDetail(sessionId, item.requestId);

        laterSetups.push({
          context: loaded.context,
          loopMeta: loaded.loopMeta,
          stage: parseJsonField('later stage setup', raw) as TYahlStage,
          stageId: item.stageId,
        });
      }

      const body: TRequestCreateForkSessionBody = {
        anchorStageId: detail.stageId,
        setups: [anchorSetup, ...laterSetups],
      };

      const result = await createForkSession(sessionId, body);

      setOpen(false);
      navigate(`/sessions/${encodeURIComponent(result.targetSessionId)}`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Rerun failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (detail.status !== 'finished') {
    return null;
  }

  return (
    <Sheet onOpenChange={setOpen} open={open}>
      <SheetTrigger
        render={
          <Button size="sm" type="button" variant="default">
            Rerun
          </Button>
        }
      />
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl" side="right">
        <SheetHeader>
          <SheetTitle>Rerun from stage</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 px-6 pb-8 text-sm">
          <p className="text-muted-foreground">
            Prefix stages fast-forward from each stage&apos;s saved contextAfter. Edited context before
            this stage merges onto that state; later session stages run normally and continue by default.
          </p>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Context before (JSON)</p>
            <textarea
              className="mt-1 min-h-32 w-full rounded-md border bg-background p-2 font-mono text-xs"
              onChange={(event) => setContextJson(event.target.value)}
              spellCheck={false}
              value={contextJson}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Buckets: {CONTEXT_BUCKETS.join(', ')}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Stage setup (JSON)</p>
            <textarea
              className="mt-1 min-h-40 w-full rounded-md border bg-background p-2 font-mono text-xs"
              onChange={(event) => setStageJson(event.target.value)}
              spellCheck={false}
              value={stageJson}
            />
          </div>
          {detail.loopMeta ? (
            <div>
              <p className="text-xs font-medium text-muted-foreground">Loop meta (JSON)</p>
              <textarea
                className="mt-1 min-h-24 w-full rounded-md border bg-background p-2 font-mono text-xs"
                onChange={(event) => setLoopMetaJson(event.target.value)}
                spellCheck={false}
                value={loopMetaJson}
              />
            </div>
          ) : null}
          {laterCandidates.length > 0 ? (
            <div>
              <p className="text-xs font-medium text-muted-foreground">Later stages (optional)</p>
              <ul className="mt-2 space-y-3">
                {laterCandidates.map((item) => {
                  const checked = selectedLaterIds.has(item.stageId);

                  return (
                    <li className="rounded-md border p-3" key={item.stageId}>
                      <label className="flex cursor-pointer items-center gap-2">
                        <input
                          checked={checked}
                          onChange={(event) => {
                            const next = event.target.checked;

                            toggleLater(item.stageId, next);

                            if (next) {
                              void loadLaterStageJson(item);
                            }
                          }}
                          type="checkbox"
                        />
                        <span className="font-mono text-xs">
                          {labelByRequestId.get(item.requestId) ?? item.requestId}
                        </span>
                      </label>
                      {checked ? (
                        <textarea
                          className="mt-2 min-h-28 w-full rounded-md border bg-background p-2 font-mono text-xs"
                          onChange={(event) => {
                            setLaterStageJson((current) => new Map(current).set(
                              item.stageId,
                              event.target.value,
                            ));
                          }}
                          placeholder="Loading stage setup…"
                          spellCheck={false}
                          value={laterStageJson.get(item.stageId) ?? ''}
                        />
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button
            disabled={submitting}
            onClick={() => void handleSubmit()}
            type="button"
          >
            {submitting ? 'Starting rerun…' : 'Start rerun'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
