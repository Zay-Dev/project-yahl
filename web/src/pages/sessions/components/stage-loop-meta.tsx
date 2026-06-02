import type { TStageLoopMeta } from "@project-yahl/server/modules/sessions/-types";

import { SessionJsonFallback } from "@/pages/sessions/components/session-json-fallback";
import { summarizeValue } from "@/pages/sessions/lib/tool-call-parse";

type TStageLoopMetaProps = {
  loopMeta: TStageLoopMeta;
};

export function StageLoopMeta({ loopMeta }: TStageLoopMetaProps) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">Loop meta</p>
      <dl className="mt-2 grid gap-3 rounded-md border bg-background p-3 text-xs sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Index</dt>
          <dd className="font-mono">{loopMeta.index}</dd>
        </div>
        {loopMeta.indexName ? (
          <div>
            <dt className="text-muted-foreground">Index name</dt>
            <dd className="font-mono">{loopMeta.indexName}</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-muted-foreground">Value</dt>
          <dd className="font-mono whitespace-pre-wrap">{summarizeValue(loopMeta.value, 120)}</dd>
        </div>
        {typeof loopMeta.temperature === "number" ? (
          <div>
            <dt className="text-muted-foreground">Temperature</dt>
            <dd className="font-mono">{loopMeta.temperature}</dd>
          </div>
        ) : null}
        {typeof loopMeta.startAt === "number" ? (
          <div>
            <dt className="text-muted-foreground">Start at</dt>
            <dd className="font-mono">{loopMeta.startAt}</dd>
          </div>
        ) : null}
        {typeof loopMeta.endAfter === "number" ? (
          <div>
            <dt className="text-muted-foreground">End after</dt>
            <dd className="font-mono">{loopMeta.endAfter}</dd>
          </div>
        ) : null}
        {typeof loopMeta.step === "number" ? (
          <div>
            <dt className="text-muted-foreground">Step</dt>
            <dd className="font-mono">{loopMeta.step}</dd>
          </div>
        ) : null}
      </dl>
      {loopMeta.arraySnapshot.length > 0 ? (
        <div className="mt-2">
          <SessionJsonFallback
            label={`Array snapshot (${loopMeta.arraySnapshot.length})`}
            value={loopMeta.arraySnapshot}
          />
        </div>
      ) : null}
    </div>
  );
}
