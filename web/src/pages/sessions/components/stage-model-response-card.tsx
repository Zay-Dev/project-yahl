import type { TResponseStageModelResponseItem } from "@project-yahl/server/modules/sessions/-api-types";

import { TokenStatsRow } from "@/pages/sessions/components/token-stats-row";

type TStageModelResponseCardProps = {
  response: TResponseStageModelResponseItem;
};

export function StageModelResponseCard({ response }: TStageModelResponseCardProps) {
  return (
    <li className="rounded-md border bg-background p-2">
      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        {response.tags?.map((tag) => (
          <span
            className="rounded border bg-muted/40 px-1.5 py-0.5 font-medium uppercase tracking-wide"
            key={tag}
          >
            {tag}
          </span>
        ))}
        {response.model ? <span>{response.model}</span> : null}
        {typeof response.durationMs === "number" ? (
          <span>{response.durationMs}ms</span>
        ) : null}
        {response.thinkingMode ? <span>thinking</span> : null}
      </div>
      {response.usage ? (
        <div className="mt-2">
          <TokenStatsRow totals={response.usage} />
        </div>
      ) : null}
      {response.contentPreview ? (
        <pre className="mt-2 overflow-auto rounded border bg-muted/30 p-2 text-xs whitespace-pre-wrap">
          {response.contentPreview}
        </pre>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">No preview</p>
      )}
    </li>
  );
}
