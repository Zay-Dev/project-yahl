import type { TResponseStageToolSummary } from "@project-yahl/server/modules/sessions/-api-types";

import { SessionJsonFallback } from "@/pages/sessions/components/session-json-fallback";
import {
  parseToolArgumentsDetailed,
  summarizeRawArguments,
} from "@/pages/sessions/lib/tool-call-parse";

type TMastermindToolCallProps = {
  tool: TResponseStageToolSummary;
};

const parseSkill = (argumentsRaw: string | null, parsed: unknown): string | undefined => {
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const skill = (parsed as { skill?: unknown }).skill;

    if (typeof skill === 'string' && skill.trim()) {
      return skill.trim();
    }
  }

  if (!argumentsRaw) {
    return undefined;
  }

  try {
    const fromRaw = JSON.parse(argumentsRaw) as { skill?: unknown };

    return typeof fromRaw.skill === 'string' ? fromRaw.skill : undefined;
  } catch {
    return undefined;
  }
};

export function MastermindToolCall({ tool }: TMastermindToolCallProps) {
  const { parseError, parsed, raw } = parseToolArgumentsDetailed(tool.arguments);
  const rawPreview = summarizeRawArguments(raw);
  const skill = parseSkill(raw, parsed);

  return (
    <div className="rounded-md border bg-background p-2">
      <p className="font-mono text-xs font-medium">
        mastermind{skill ? ` — ${skill}` : ''}
      </p>
      {parsed !== null && parsed !== undefined ? (
        <SessionJsonFallback label="Arguments" value={parsed} />
      ) : rawPreview ? (
        <>
          {parseError ? (
            <p className="mt-1 text-xs text-destructive">Parse error: {parseError}</p>
          ) : null}
          <p className="mt-2 text-xs text-muted-foreground">Raw arguments</p>
          <pre className="mt-1 max-h-64 overflow-auto rounded border bg-muted/30 p-2 text-xs whitespace-pre-wrap">
            {rawPreview}
          </pre>
        </>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">No arguments</p>
      )}
    </div>
  );
}
