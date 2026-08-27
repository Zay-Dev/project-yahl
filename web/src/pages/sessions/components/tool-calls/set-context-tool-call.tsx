import type { TResponseStageToolSummary } from "@project-yahl/server/modules/sessions/-api-types";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  isSetContextArgs,
  parseToolArgumentsDetailed,
  summarizeRawArguments,
  summarizeValue,
} from "@/pages/sessions/lib/tool-call-parse";

type TSetContextToolCallProps = {
  tool: TResponseStageToolSummary;
};

export function SetContextToolCall({ tool }: TSetContextToolCallProps) {
  const { parseError, parsed, raw } = parseToolArgumentsDetailed(tool.arguments);

  if (!isSetContextArgs(parsed)) {
    const rawPreview = summarizeRawArguments(raw);

    return (
      <div className="rounded-md border bg-background p-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs font-medium">set_context</span>
          <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-xs text-destructive">
            unparsed arguments
          </span>
        </div>
        {parseError ? (
          <p className="mt-2 text-xs text-destructive">Parse error: {parseError}</p>
        ) : null}
        {rawPreview ? (
          <>
            <p className="mt-2 text-xs text-muted-foreground">Raw arguments</p>
            <pre className="mt-1 max-h-64 overflow-auto rounded border bg-muted/30 p-2 text-xs whitespace-pre-wrap">
              {rawPreview}
            </pre>
          </>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">No arguments stored</p>
        )}
      </div>
    );
  }

  const args = parsed;
  const operation = args.operation ?? "set";

  return (
    <div className="rounded-md border bg-background p-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs font-medium">set_context</span>
        <span className="rounded bg-muted px-1.5 py-0.5 text-xs">{args.scope}</span>
        <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-xs">{args.key}</span>
        <span className="text-xs text-muted-foreground">{operation}</span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Value preview</p>
      <pre className="mt-1 overflow-auto rounded border bg-muted/30 p-2 text-xs whitespace-pre-wrap">
        {summarizeValue(args.value)}
      </pre>
      <Collapsible className="mt-2">
        <CollapsibleTrigger className="text-xs text-primary underline-offset-2 hover:underline">
          Show full value
        </CollapsibleTrigger>
        <CollapsibleContent>
          <pre className="mt-2 max-h-64 overflow-auto rounded border bg-muted/30 p-2 text-xs break-all whitespace-pre-wrap">
            {JSON.stringify(args.value, null, 2)}
          </pre>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
