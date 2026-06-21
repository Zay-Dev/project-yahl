import type { TResponseStageToolCallItem } from "@project-yahl/server/modules/sessions/-api-types";

import { AskUserToolCall } from "./ask-user-tool-call";
import { GenericToolCall } from "./generic-tool-call";
import { MastermindToolCall } from "./mastermind-tool-call";
import { SetContextToolCall } from "./set-context-tool-call";

type TToolCallListProps = {
  toolCalls: TResponseStageToolCallItem[];
};

const ToolEntry = ({
  tool,
}: {
  tool: TResponseStageToolCallItem["tools"][number];
}) => {
  if (tool.name === "set_context") {
    return <SetContextToolCall tool={tool} />;
  }

  if (tool.name === "ask_user") {
    return <AskUserToolCall tool={tool} />;
  }

  if (tool.name === "mastermind") {
    return <MastermindToolCall tool={tool} />;
  }

  return <GenericToolCall tool={tool} />;
};

export function ToolCallList({ toolCalls }: TToolCallListProps) {
  if (toolCalls.length === 0) {
    return null;
  }

  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">Tool calls</p>
      <ul className="mt-2 space-y-3">
        {toolCalls.map((entry) => (
          <li key={entry._id} className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {new Date(entry.createdAt).toLocaleString()}
            </p>
            {entry.tools.map((tool) => (
              <ToolEntry key={tool.id} tool={tool} />
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
}
