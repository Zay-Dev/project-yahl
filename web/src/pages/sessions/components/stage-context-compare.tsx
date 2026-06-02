import type { TYahlStage } from "@project-yahl/server/modules/sessions/-types";

import { useMemo, useState } from "react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  CONTEXT_BUCKETS,
  diffContextBucketWithBaseline,
  type TContextBucket,
  type TContextDiffEntry,
  type TStageMutationKeys,
} from "@/pages/sessions/lib/context-diff";
import { summarizeValue } from "@/pages/sessions/lib/tool-call-parse";

type TStageContextCompareProps = {
  after?: Record<string, unknown>;
  baselineAfter?: Record<string, unknown>;
  before: Record<string, unknown>;
  stage: TYahlStage;
};

const diffClass = (kind: TContextDiffEntry["kind"]) => {
  if (kind === "added") {
    return "border-l-2 border-l-emerald-500 bg-emerald-500/10";
  }

  if (kind === "removed") {
    return "border-l-2 border-l-destructive bg-destructive/10";
  }

  if (kind === "changed") {
    return "border-l-2 border-l-amber-500 bg-amber-500/10";
  }

  return "";
};

const formatDiffValue = (value: unknown) => {
  if (value === undefined) {
    return null;
  }

  try {
    const serialized = JSON.stringify(value, null, 2);

    return serialized ?? String(value);
  } catch {
    return String(value);
  }
};

const DiffValueCell = ({ value }: { value: unknown }) => {
  const [expanded, setExpanded] = useState(false);

  if (value === undefined) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  const preview = summarizeValue(value, 120);
  const full = formatDiffValue(value);
  const isLong = full.length > preview.length + 10;

  return (
    <div>
      <pre className="text-xs whitespace-pre-wrap">{expanded ? full : preview}</pre>
      {isLong ? (
        <button
          className="mt-1 text-xs text-primary underline-offset-2 hover:underline"
          onClick={() => setExpanded((current) => !current)}
          type="button"
        >
          {expanded ? "Show less" : "Show full JSON"}
        </button>
      ) : null}
    </div>
  );
};

const DiffRow = ({ entry }: { entry: TContextDiffEntry }) => (
  <div className={`grid gap-2 rounded p-2 lg:grid-cols-[10rem_1fr_1fr] ${diffClass(entry.kind)}`}>
    <span className="font-mono text-xs text-muted-foreground">{entry.path}</span>
    <div>
      <p className="mb-0.5 text-xs text-muted-foreground lg:hidden">Before</p>
      <DiffValueCell value={entry.before} />
    </div>
    <div>
      <p className="mb-0.5 text-xs text-muted-foreground lg:hidden">After</p>
      <DiffValueCell value={entry.after} />
    </div>
  </div>
);

const BucketPanel = ({
  after,
  baselineAfter,
  before,
  bucket,
  mutationKeys,
}: {
  after?: Record<string, unknown>;
  baselineAfter?: Record<string, unknown>;
  before: Record<string, unknown>;
  bucket: TContextBucket;
  mutationKeys: TStageMutationKeys;
}) => {
  const entries = diffContextBucketWithBaseline(
    before,
    after,
    bucket,
    baselineAfter,
    mutationKeys,
  );
  const changed = entries.filter((entry) => entry.kind !== "unchanged");
  const unchanged = entries.filter((entry) => entry.kind === "unchanged");

  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">No keys in this bucket.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="hidden gap-2 border-b pb-2 text-xs font-medium text-muted-foreground lg:grid lg:grid-cols-[10rem_1fr_1fr]">
        <span>Path</span>
        <span>Before</span>
        <span>{after ? "After" : "After (pending)"}</span>
      </div>
      {changed.map((entry) => (
        <DiffRow key={entry.path} entry={entry} />
      ))}
      {unchanged.length > 0 ? (
        <Collapsible>
          <CollapsibleTrigger className="text-xs text-muted-foreground underline-offset-2 hover:underline">
            Unchanged ({unchanged.length})
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 space-y-2">
            {unchanged.map((entry) => (
              <DiffRow key={entry.path} entry={entry} />
            ))}
          </CollapsibleContent>
        </Collapsible>
      ) : null}
    </div>
  );
};

export function StageContextCompare({
  after,
  baselineAfter,
  before,
  stage,
}: TStageContextCompareProps) {
  const [bucket, setBucket] = useState<TContextBucket>("context");

  const mutationKeys = useMemo<TStageMutationKeys>(() => ({
    produceContextKeys: stage.produceContextKeys,
    produceTypeKeys: stage.produceTypeKeys,
    updateContextKeys: stage.updateContextKeys,
  }), [stage.produceContextKeys, stage.produceTypeKeys, stage.updateContextKeys]);

  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">Context</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {CONTEXT_BUCKETS.map((key) => (
          <button
            className={
              bucket === key
                ? "rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground"
                : "rounded-md border bg-background px-2 py-1 text-xs hover:bg-muted"
            }
            key={key}
            onClick={() => setBucket(key)}
            type="button"
          >
            {key}
          </button>
        ))}
      </div>
      <div className="mt-3">
        <BucketPanel
          after={after}
          baselineAfter={baselineAfter}
          before={before}
          bucket={bucket}
          mutationKeys={mutationKeys}
        />
      </div>
    </div>
  );
}
