import type { TResponseStageModelResponseItem } from "@project-yahl/server/modules/sessions/-api-types";

import { TokenStatsRow } from "@/pages/sessions/components/token-stats-row";

type TStageModelResponseCardProps = {
  response: TResponseStageModelResponseItem;
};

const contentFromResponse = (response: TResponseStageModelResponseItem) => {
  const raw = response.response as
    | { choices?: Array<{ message?: { content?: unknown } }> }
    | undefined;
  const content = raw?.choices?.[0]?.message?.content;

  if (typeof content === "string" && content.length > 0) {
    return content;
  }

  if (content !== undefined && content !== null) {
    return JSON.stringify(content);
  }

  return response.contentPreview || "";
};

export function StageModelResponseCard({ response }: TStageModelResponseCardProps) {
  const content = contentFromResponse(response);
  const domains = response.domain?.trim() ? [response.domain.trim()] : [];

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
        {response.createdAt ? (
          <span>{new Date(response.createdAt).toLocaleString()}</span>
        ) : null}
        {response.model ? <span>{response.model}</span> : null}
        {typeof response.durationMs === "number" ? (
          <span>{response.durationMs}ms</span>
        ) : null}
        {response.thinkingMode ? <span>thinking</span> : null}
      </div>
      {response.usage || domains.length > 0 ? (
        <div className="mt-2">
          <TokenStatsRow domains={domains} totals={response.usage} />
        </div>
      ) : null}
      {content ? (
        <pre className="mt-2 max-h-[min(70vh,40rem)] overflow-auto rounded border bg-muted/30 p-2 text-xs whitespace-pre-wrap">
          {content}
        </pre>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">No preview</p>
      )}
    </li>
  );
}
