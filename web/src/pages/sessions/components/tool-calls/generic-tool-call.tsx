import type { TResponseStageToolSummary } from "@project-yahl/server/modules/sessions/-api-types";

import { SessionJsonFallback } from "@/pages/sessions/components/session-json-fallback";

type TGenericToolCallProps = {
  tool: TResponseStageToolSummary;
};

export function GenericToolCall({ tool }: TGenericToolCallProps) {
  return (
    <div className="rounded-md border bg-background p-2">
      <p className="font-mono text-xs font-medium">{tool.name}</p>
      {tool.arguments !== null && tool.arguments !== undefined ? (
        <SessionJsonFallback label="Arguments" value={tool.arguments} />
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">No arguments</p>
      )}
    </div>
  );
}
