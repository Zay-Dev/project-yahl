import type { TResponseStageModelResponseItem } from "@project-yahl/server/modules/sessions/-api-types";

import { TokenStatsRow } from "@/pages/sessions/components/token-stats-row";
import { GenericToolCall } from "@/pages/sessions/components/tool-calls/generic-tool-call";

import {
  previewFromModelResponse,
  toolCallsFromModelResponse,
} from "@/pages/sessions/lib/model-response-preview";

type TStageModelResponseCardProps = {
  response: TResponseStageModelResponseItem;
};

export function StageModelResponseCard({ response }: TStageModelResponseCardProps) {
  const preview = previewFromModelResponse(response);
  const toolCalls = toolCallsFromModelResponse(response);
  const domains = response.domain?.trim() ? [response.domain.trim()] : [];
  const hasPreview = preview.text.length > 0;

  return (
    <li className="min-w-0 rounded-md border bg-background p-2">
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
      {hasPreview ? (
        <>
          {preview.kind === "reasoning" ? (
            <p className="mt-2 text-xs text-muted-foreground">Reasoning</p>
          ) : null}
          <pre className="mt-2 max-h-[min(70vh,40rem)] overflow-auto rounded border bg-muted/30 p-2 text-xs break-all whitespace-pre-wrap">
            {preview.text}
          </pre>
        </>
      ) : null}
      {toolCalls.length > 0 ? (
        <div className="mt-2 space-y-2">
          {toolCalls.map((tool) => (
            <GenericToolCall key={tool.id} tool={tool} />
          ))}
        </div>
      ) : null}
      {!hasPreview && toolCalls.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">No preview</p>
      ) : null}
    </li>
  );
}
