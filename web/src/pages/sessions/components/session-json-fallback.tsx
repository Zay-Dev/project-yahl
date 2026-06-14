import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

type TSessionJsonFallbackProps = {
  label: string;
  value: unknown;
};

export function SessionJsonFallback({ label, value }: TSessionJsonFallbackProps) {
  return (
    <Collapsible className="rounded-xl border bg-muted/30">
      <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium">
        {label}
        <span className="text-xs text-muted-foreground">Show raw JSON</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t px-4 pb-4">
        <pre className="mt-3 overflow-auto rounded-lg border bg-background p-3 text-xs">
          {JSON.stringify(value, null, 2)}
        </pre>
      </CollapsibleContent>
    </Collapsible>
  );
}
