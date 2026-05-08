import { Fragment } from "react";

import type { A2uiPreviewModel, ParsedNode } from "@/lib/a2ui-v08-preview";
import { cn } from "@/lib/utils";

type Props = {
  model: A2uiPreviewModel;
};

const variantClass = (variant?: string) => {
  switch (variant) {
    case "h3":
      return "text-lg font-semibold text-slate-900 dark:text-slate-100";
    case "h4":
      return "text-base font-semibold text-slate-900 dark:text-slate-100";
    case "caption":
      return "text-xs text-slate-500 dark:text-slate-400";
    case "body":
    default:
      return "text-sm text-slate-800 whitespace-pre-wrap dark:text-slate-200";
  }
};

const NodeView = ({ id, nodes }: { id: string; nodes: Map<string, ParsedNode> }) => {
  const node = nodes.get(id);
  if (!node) return null;

  if (node.kind === "text") {
    return <p className={cn("m-0", variantClass(node.variant))}>{node.text}</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {node.childIds.map((childId) => (
        <Fragment key={childId}>
          <NodeView id={childId} nodes={nodes} />
        </Fragment>
      ))}
    </div>
  );
};

export const A2uiV08Preview = ({ model }: Props) => (
  <div className="rounded-md border border-slate-200 bg-slate-50/90 p-4 dark:border-slate-700 dark:bg-slate-900/50">
    <NodeView id="root" nodes={model.nodes} />
  </div>
);
