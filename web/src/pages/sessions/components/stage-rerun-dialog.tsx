import type {
  TRequestCreateForkSessionBody,
  TResponseStageDetail,
} from "@project-yahl/server/modules/sessions/-api-types";
import type { TParsedStage, TStageLoopMeta, TYahlStage } from "@project-yahl/server/modules/sessions/-types";

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
import { bucketFromPayload } from "@/pages/sessions/lib/context-diff";
import {
  laterOriginalStageLabel,
  laterOriginalStagesForRerun,
} from "@/pages/sessions/lib/rerun-later-stages";
import { SESSION_SHEET_WIDTH } from "@/pages/sessions/lib/session-sheet";
import { createForkSession } from "@/pages/sessions/lib/sessions-api";

type TStageRerunDialogProps = {
  detail: TResponseStageDetail;
  originalStages: TParsedStage[];
  sessionId: string;
};

const EMPTY_OBJECT_JSON = '{}';

const parseJsonField = (label: string, raw: string) => {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new Error(`Invalid JSON in ${label}`);
  }
};

const bucketJsonFromDetail = (
  context: Record<string, unknown>,
  bucket: 'context' | 'types',
  editFromData: boolean,
) => {
  if (!editFromData) {
    return EMPTY_OBJECT_JSON;
  }

  return JSON.stringify(bucketFromPayload(context, bucket), null, 2);
};

const laterLogicPreview = (logic: TYahlStage['logic'] | undefined) => {
  const text = typeof logic === 'string'
    ? logic
    : logic && typeof logic === 'object' && '$ref' in logic
      ? `$ref: ${logic.$ref}`
      : logic && typeof logic === 'object' && 'stages' in logic
        ? `stages[${logic.stages.length}]`
        : '';

  const lines = text
    .split('\n')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .slice(0, 5);

  return lines.join('\n') || '—';
};

export function StageRerunDialog({
  detail,
  originalStages,
  sessionId,
}: TStageRerunDialogProps) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editContextFromData, setEditContextFromData] = useState(true);
  const [editTypesFromData, setEditTypesFromData] = useState(true);
  const [contextBucketJson, setContextBucketJson] = useState(
    () => bucketJsonFromDetail(detail.context, 'context', true),
  );
  const [typesBucketJson, setTypesBucketJson] = useState(
    () => bucketJsonFromDetail(detail.context, 'types', true),
  );
  const [stageJson, setStageJson] = useState(() => JSON.stringify(detail.stage, null, 2));
  const [loopMetaJson, setLoopMetaJson] = useState(
    () => (detail.loopMeta ? JSON.stringify(detail.loopMeta, null, 2) : ''),
  );
  const [selectedLaterIds, setSelectedLaterIds] = useState<Set<number>>(() => new Set());
  const [laterStageJson, setLaterStageJson] = useState<Map<number, string>>(() => new Map());

  const laterCandidates = useMemo(
    () => laterOriginalStagesForRerun(originalStages, detail.parsedStageIndex),
    [detail.parsedStageIndex, originalStages],
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    setEditContextFromData(true);
    setEditTypesFromData(true);
    setContextBucketJson(bucketJsonFromDetail(detail.context, 'context', true));
    setTypesBucketJson(bucketJsonFromDetail(detail.context, 'types', true));
    setStageJson(JSON.stringify(detail.stage, null, 2));
    setLoopMetaJson(detail.loopMeta ? JSON.stringify(detail.loopMeta, null, 2) : '');
    setSelectedLaterIds(new Set());
    setLaterStageJson(new Map());
    setError(null);
  }, [detail, open]);

  const handleEditContextFromDataChange = (checked: boolean) => {
    setEditContextFromData(checked);
    setContextBucketJson(bucketJsonFromDetail(detail.context, 'context', checked));
  };

  const handleEditTypesFromDataChange = (checked: boolean) => {
    setEditTypesFromData(checked);
    setTypesBucketJson(bucketJsonFromDetail(detail.context, 'types', checked));
  };

  const toggleLater = (parsedStageIndex: number, spec: TYahlStage, checked: boolean) => {
    setSelectedLaterIds((current) => {
      const next = new Set(current);

      if (checked) {
        next.add(parsedStageIndex);
      } else {
        next.delete(parsedStageIndex);
      }

      return next;
    });

    if (!checked) {
      return;
    }

    setLaterStageJson((current) => {
      if (current.has(parsedStageIndex)) {
        return current;
      }

      return new Map(current).set(parsedStageIndex, JSON.stringify(spec, null, 2));
    });
  };

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);

    try {
      const contextPayload = {
        ...detail.context,
        context: parseJsonField('context', contextBucketJson),
        types: parseJsonField('types', typesBucketJson),
      };
      const stage = parseJsonField('stage setup', stageJson) as TYahlStage;
      const loopMeta = loopMetaJson.trim()
        ? parseJsonField('loop meta', loopMetaJson) as TStageLoopMeta
        : undefined;

      const anchorSetup = {
        context: contextPayload,
        loopMeta,
        stage,
        stageId: detail.stageId,
      };

      const laterSetups: TRequestCreateForkSessionBody['setups'] = [];

      for (const item of laterCandidates) {
        if (!selectedLaterIds.has(item.parsedStageIndex)) {
          continue;
        }

        const raw = laterStageJson.get(item.parsedStageIndex);

        if (!raw) {
          throw new Error(`Stage ${laterOriginalStageLabel(item.parsed, item.parsedStageIndex)} is not loaded`);
        }

        laterSetups.push({
          context: {},
          parsedStageIndex: item.parsedStageIndex,
          stage: parseJsonField('later stage setup', raw) as TYahlStage,
          stageId: item.parsed.spec.id?.trim() || `parsed:${item.parsedStageIndex}`,
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
      <SheetContent className={`${SESSION_SHEET_WIDTH} overflow-y-auto`} side="right">
        <SheetHeader>
          <SheetTitle>Rerun from stage</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 px-6 pb-8 text-sm">
          <p className="text-muted-foreground">
            Prefix stages fast-forward from each stage&apos;s saved contextAfter. Edited context before
            this stage merges onto that state; later original task stages run from the task YAML and
            continue by default.
          </p>
          <div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-muted-foreground">Context (JSON)</p>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  checked={editContextFromData}
                  onChange={(event) => handleEditContextFromDataChange(event.target.checked)}
                  type="checkbox"
                />
                <span className="text-xs">Edit from data</span>
              </label>
            </div>
            <textarea
              className="mt-1 min-h-32 w-full rounded-md border bg-background p-2 font-mono text-xs"
              onChange={(event) => setContextBucketJson(event.target.value)}
              spellCheck={false}
              value={contextBucketJson}
            />
          </div>
          <div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-muted-foreground">Types (JSON)</p>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  checked={editTypesFromData}
                  onChange={(event) => handleEditTypesFromDataChange(event.target.checked)}
                  type="checkbox"
                />
                <span className="text-xs">Edit from data</span>
              </label>
            </div>
            <textarea
              className="mt-1 min-h-32 w-full rounded-md border bg-background p-2 font-mono text-xs"
              onChange={(event) => setTypesBucketJson(event.target.value)}
              spellCheck={false}
              value={typesBucketJson}
            />
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
              <p className="text-xs font-medium text-muted-foreground">Later original task stages (optional)</p>
              <ul className="mt-2 space-y-3">
                {laterCandidates.map((item) => {
                  const checked = selectedLaterIds.has(item.parsedStageIndex);

                  return (
                    <li className="rounded-md border p-3" key={item.parsedStageIndex}>
                      <label className="flex cursor-pointer items-center gap-2">
                        <input
                          checked={checked}
                          onChange={(event) => {
                            toggleLater(
                              item.parsedStageIndex,
                              item.parsed.spec,
                              event.target.checked,
                            );
                          }}
                          type="checkbox"
                        />
                        <span className="font-mono text-xs">
                          {laterOriginalStageLabel(item.parsed, item.parsedStageIndex)}
                        </span>
                      </label>
                      <pre className="mt-2 max-h-32 overflow-auto rounded-md border bg-muted/30 p-2 text-xs whitespace-pre-wrap">
                        {laterLogicPreview(item.parsed.spec.logic)}
                      </pre>
                      {checked ? (
                        <textarea
                          className="mt-2 min-h-28 w-full rounded-md border bg-background p-2 font-mono text-xs"
                          onChange={(event) => {
                            setLaterStageJson((current) => new Map(current).set(
                              item.parsedStageIndex,
                              event.target.value,
                            ));
                          }}
                          spellCheck={false}
                          value={laterStageJson.get(item.parsedStageIndex) ?? ''}
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
