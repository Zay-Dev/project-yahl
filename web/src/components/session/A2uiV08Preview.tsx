import { Fragment } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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

const textValue = (value?: string) => value || "—";
type TableCell = { label: string; url?: string };
type TableLink = { label: string; url: string };

const renderTableText = (nodeId: string, nodes: Map<string, ParsedNode>): string => {
  const node = nodes.get(nodeId);
  if (!node) return "";
  if (node.kind === "text") return node.text;
  if (node.kind === "button") return node.label || "";
  if (node.kind === "column" || node.kind === "row" || node.kind === "list") {
    return node.childIds.map((childId) => renderTableText(childId, nodes)).filter(Boolean).join(" ");
  }
  return "";
};

const renderTableLink = (nodeId: string, nodes: Map<string, ParsedNode>): TableLink | null => {
  const node = nodes.get(nodeId);
  if (!node) return null;
  if (node.kind === "button" && node.actionUrl) {
    const label = node.childId
      ? renderTableText(node.childId, nodes)
      : (node.label || "Open");
    return { label, url: node.actionUrl };
  }
  if (node.kind === "column" || node.kind === "row" || node.kind === "list") {
    for (const childId of node.childIds) {
      const hit = renderTableLink(childId, nodes);
      if (hit) return hit;
    }
  }
  return null;
};

const readTableRow = (rowId: string, nodes: Map<string, ParsedNode>): TableCell[] | null => {
  const row = nodes.get(rowId);
  if (!row || row.kind !== "row") return null;

  return row.childIds.map((cellId) => {
    const link = renderTableLink(cellId, nodes);
    if (link) return link;

    return { label: renderTableText(cellId, nodes) };
  });
};

const tryRenderSemanticTable = (id: string, nodes: Map<string, ParsedNode>) => {
  const node = nodes.get(id);
  if (!node || node.kind !== "column") return null;
  if (!node.childIds.includes("tbl_header")) return null;

  const headerCells = readTableRow("tbl_header", nodes);
  if (!headerCells?.length) return null;

  const rowIds = node.childIds.filter((childId) => childId.startsWith("tbl_row_"));
  if (!rowIds.length) return null;

  const bodyRows = rowIds
    .map((rowId) => readTableRow(rowId, nodes))
    .filter((row): row is TableCell[] => !!row && !!row.length);
  if (!bodyRows.length) return null;

  return (
    <div className="overflow-x-auto rounded border border-slate-200 dark:border-slate-700">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-100 dark:bg-slate-800">
          <tr>
            {headerCells.map((cell, index) => (
              <th className="px-2 py-1.5 font-semibold text-slate-900 dark:text-slate-100" key={`head_${index}`}>
                {cell.label || "—"}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bodyRows.map((cells, rowIndex) => (
            <tr className="border-t border-slate-200 align-top dark:border-slate-700" key={`row_${rowIndex}`}>
              {cells.map((cell, cellIndex) => (
                <td className="px-2 py-1.5 text-slate-800 dark:text-slate-200" key={`cell_${rowIndex}_${cellIndex}`}>
                  {cell.url
                    ? (
                      <a className="text-blue-600 underline dark:text-blue-400" href={cell.url} rel="noreferrer noopener" target="_blank">
                        {cell.label || cell.url}
                      </a>
                    )
                    : (cell.label || "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const NodeView = ({ id, nodes, parentId, visited }: { id: string; nodes: Map<string, ParsedNode>; parentId?: string; visited: Set<string> }) => {
  if (visited.has(id)) return <p className="text-xs text-slate-500 dark:text-slate-400">Recursive node: {id}</p>;
  const node = nodes.get(id);
  if (!node) return null;
  const nextVisited = new Set(visited);
  nextVisited.add(id);

  if (node.kind === "text") {
    const parent = parentId ? nodes.get(parentId) : null;
    const isSummaryOrDetailBody =
      id === "body" &&
      node.variant === "body" &&
      !!parent &&
      parent.kind === "column" &&
      parent.childIds.includes("title");

    if (isSummaryOrDetailBody) {
      return (
        <div className={cn("prose prose-sm max-w-none dark:prose-invert", variantClass(node.variant))}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {node.text}
          </ReactMarkdown>
        </div>
      );
    }

    return <p className={cn("m-0", variantClass(node.variant))}>{node.text}</p>;
  }

  if (node.kind === "divider") {
    return node.axis === "vertical"
      ? <div className="h-8 w-px bg-slate-300 dark:bg-slate-700" />
      : <div className="h-px w-full bg-slate-300 dark:bg-slate-700" />;
  }

  if (node.kind === "icon") {
    return <p className="text-xs text-slate-600 dark:text-slate-300">Icon: {textValue(node.name)}</p>;
  }

  if (node.kind === "image") {
    return (
      <div className="rounded border border-slate-300 bg-white p-2 text-xs dark:border-slate-700 dark:bg-slate-950">
        <p className="font-medium">Image</p>
        <p className="break-all text-slate-600 dark:text-slate-300">{textValue(node.url)}</p>
        {node.fit ? <p className="text-slate-500 dark:text-slate-400">fit: {node.fit}</p> : null}
      </div>
    );
  }

  if (node.kind === "button") {
    const content = node.childId
      ? <NodeView id={node.childId} nodes={nodes} parentId={id} visited={nextVisited} />
      : (node.label || "Button");
    if (node.actionUrl) {
      return (
        <a
          className="inline-flex items-center rounded border border-slate-300 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
          href={node.actionUrl}
          rel="noreferrer noopener"
          target="_blank"
        >
          {content}
          {node.variant ? <span className="ml-2 text-slate-500">({node.variant})</span> : null}
        </a>
      );
    }
    return (
      <button className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900" type="button">
        {content}
        {node.variant ? <span className="ml-2 text-slate-500">({node.variant})</span> : null}
      </button>
    );
  }

  if (node.kind === "text_field") {
    return (
      <div className="space-y-1">
        {node.label ? <p className="text-xs font-medium">{node.label}</p> : null}
        <input
          className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-950"
          disabled
          readOnly
          value={node.value || ""}
        />
        {node.textFieldType || node.validationRegexp ? (
          <p className="text-[10px] text-slate-500 dark:text-slate-400">
            {[node.textFieldType ? `type=${node.textFieldType}` : "", node.validationRegexp ? "has-validation" : ""].filter(Boolean).join(", ")}
          </p>
        ) : null}
      </div>
    );
  }

  if (node.kind === "checkbox") {
    return (
      <label className="flex items-center gap-2 text-xs">
        <input checked={!!node.value} disabled readOnly type="checkbox" />
        <span>{textValue(node.label)}</span>
      </label>
    );
  }

  if (node.kind === "slider") {
    const min = typeof node.minValue === "number" ? node.minValue : 0;
    const max = typeof node.maxValue === "number" ? node.maxValue : 100;
    const value = typeof node.value === "number" ? node.value : min;
    return (
      <div className="space-y-1">
        <input className="w-full" disabled max={max} min={min} readOnly type="range" value={value} />
        <p className="text-[10px] text-slate-500 dark:text-slate-400">
          value={value}, min={min}, max={max}
        </p>
      </div>
    );
  }

  if (node.kind === "date_time_input") {
    return (
      <div className="rounded border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-950">
        <p>{node.value || ""}</p>
        <p className="text-[10px] text-slate-500 dark:text-slate-400">
          {[node.enableDate ? "date" : "", node.enableTime ? "time" : ""].filter(Boolean).join("+") || "date/time"}
        </p>
      </div>
    );
  }

  if (node.kind === "choice_picker") {
    return (
      <div className="space-y-1 rounded border border-slate-300 bg-white p-2 text-xs dark:border-slate-700 dark:bg-slate-950">
        {node.options.map((option) => (
          <label className="flex items-center gap-2" key={option.value}>
            <input checked={node.selectionValues.includes(option.value)} disabled readOnly type="checkbox" />
            <span>{option.label}</span>
          </label>
        ))}
        {typeof node.maxAllowedSelections === "number" ? (
          <p className="text-[10px] text-slate-500 dark:text-slate-400">max selections: {node.maxAllowedSelections}</p>
        ) : null}
      </div>
    );
  }

  if (node.kind === "card") {
    return (
      <div className="rounded border border-slate-300 bg-white p-3 dark:border-slate-700 dark:bg-slate-950">
        {node.childId ? <NodeView id={node.childId} nodes={nodes} parentId={id} visited={nextVisited} /> : null}
      </div>
    );
  }

  if (node.kind === "modal") {
    return (
      <div className="space-y-2 rounded border border-dashed border-slate-400 bg-white p-2 text-xs dark:border-slate-600 dark:bg-slate-950">
        <p className="font-medium">Modal</p>
        {node.entryPointChildId ? (
          <div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">entry point</p>
            <NodeView id={node.entryPointChildId} nodes={nodes} parentId={id} visited={nextVisited} />
          </div>
        ) : null}
        {node.contentChildId ? (
          <div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">content</p>
            <NodeView id={node.contentChildId} nodes={nodes} parentId={id} visited={nextVisited} />
          </div>
        ) : null}
      </div>
    );
  }

  if (node.kind === "tabs") {
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1">
          {node.items.map((item) => (
            <span className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[10px] dark:border-slate-700 dark:bg-slate-950" key={item.childId}>
              {item.title}
            </span>
          ))}
        </div>
        {node.items[0] ? <NodeView id={node.items[0].childId} nodes={nodes} parentId={id} visited={nextVisited} /> : null}
      </div>
    );
  }

  const semanticTable = tryRenderSemanticTable(id, nodes);
  if (semanticTable) return semanticTable;

  const containerClass = node.kind === "row" ? "flex flex-row flex-wrap gap-2" : "flex flex-col gap-2";
  return (
    <div className={containerClass}>
      {node.childIds.map((childId) => (
        <Fragment key={childId}>
          <NodeView id={childId} nodes={nodes} parentId={id} visited={nextVisited} />
        </Fragment>
      ))}
    </div>
  );
};

export const A2uiV08Preview = ({ model }: Props) => (
  <div className="rounded-md border border-slate-200 bg-slate-50/90 p-4 dark:border-slate-700 dark:bg-slate-900/50">
    <NodeView id={model.rootId} nodes={model.nodes} visited={new Set()} />
  </div>
);
