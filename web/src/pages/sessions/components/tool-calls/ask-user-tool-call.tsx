import type { TResponseStageToolSummary } from "@project-yahl/server/modules/sessions/-api-types";

type TAskUserToolCallProps = {
  tool: TResponseStageToolSummary;
};

const parseAskUserArgs = (raw: unknown) => {
  if (!raw || typeof raw !== 'object') {
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw) as Record<string, unknown>;
      } catch {
        return null;
      }
    }

    return null;
  }

  return raw as Record<string, unknown>;
};

export function AskUserToolCall({ tool }: TAskUserToolCallProps) {
  const args = parseAskUserArgs(tool.arguments);
  const title = typeof args?.title === 'string' ? args.title : 'ask_user';
  const questionRef = typeof args?.questionRef === 'string' ? args.questionRef : null;
  const options = Array.isArray(args?.options)
    ? args.options.filter((option) => (
      option
      && typeof option === 'object'
      && typeof (option as { id?: string }).id === 'string'
      && typeof (option as { label?: string }).label === 'string'
    )) as { id: string; label: string }[]
    : [];

  return (
    <div className="rounded-md border bg-background p-2">
      <p className="font-mono text-xs font-medium">ask_user</p>
      <p className="mt-1 text-sm font-medium">{title}</p>
      {questionRef ? (
        <p className="mt-1 font-mono text-xs text-muted-foreground">{questionRef}</p>
      ) : null}
      {options.length > 0 ? (
        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
          {options.map((option) => (
            <li key={option.id}>
              {option.id}: {option.label}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
