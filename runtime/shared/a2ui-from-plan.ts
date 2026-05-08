import type { A2uiPlanV1 } from "./a2ui-plan";

import {
  getByJsonPointer,
  getByRelativePointer,
  resolvePlanMaxItems,
  toDisplayString,
} from "./a2ui-plan";

type A2uiEnvelope =
  | { createSurface: { catalogId: string; surfaceId: string }; version: "v0.8" }
  | { updateComponents: { components: unknown[]; surfaceId: string }; version: "v0.8" }
  | { updateDataModel: { path: string; surfaceId: string; value: unknown }; version: "v0.8" };

const basicCatalogId = "https://a2ui.org/specification/v0_8/basic_catalog.json";

const surfaceHeader = (surfaceId: string): A2uiEnvelope[] => [
  {
    createSurface: {
      catalogId: basicCatalogId,
      surfaceId,
    },
    version: "v0.8",
  },
];

const assertBinding = (plan: A2uiPlanV1, key: string): string | null => {
  const path = plan.bindings[key];
  if (typeof path !== "string" || !path.trim()) return null;
  return path.trim();
};

export const toA2uiFromPlan = (rootData: unknown, plan: A2uiPlanV1): A2uiEnvelope[] => {
  const surfaceId = plan.surfaceId;
  const maxItems = resolvePlanMaxItems(plan);

  if (plan.ui_kind === "summary_card" || plan.ui_kind === "detail_card") {
    const titlePath = assertBinding(plan, "title");
    const bodyPath = assertBinding(plan, "body");
    if (!titlePath || !bodyPath) return [];

    const title = toDisplayString(getByJsonPointer(rootData, titlePath));
    const body = toDisplayString(getByJsonPointer(rootData, bodyPath));
    const subtitlePath = plan.bindings.subtitle;
    const subtitle = subtitlePath
      ? toDisplayString(getByJsonPointer(rootData, subtitlePath))
      : "";

    return [
      ...surfaceHeader(surfaceId),
      {
        updateComponents: {
          components: [
            {
              children: subtitle ? ["title", "subtitle", "body"] : ["title", "body"],
              component: "Column",
              id: "root",
            },
            {
              component: "Text",
              id: "title",
              text: title,
              variant: "h3",
            },
            ...(subtitle
              ? [{
                component: "Text",
                id: "subtitle",
                text: subtitle,
                variant: "caption",
              }]
              : []),
            {
              component: "Text",
              id: "body",
              text: body,
              variant: "body",
            },
          ],
          surfaceId,
        },
        version: "v0.8",
      },
    ];
  }

  if (plan.ui_kind === "metric_cards") {
    const itemsPath = assertBinding(plan, "items");
    if (!itemsPath) return [];

    const rawItems = getByJsonPointer(rootData, itemsPath);
    if (!Array.isArray(rawItems)) return [];

    const labelRel = assertBinding(plan, "item_label") || "/label";
    const valueRel = assertBinding(plan, "item_value") || "/value";

    const slice = rawItems.slice(0, maxItems);
    const metrics = slice.map((item) => ({
      label: toDisplayString(getByRelativePointer(item, labelRel), 200),
      value: toDisplayString(getByRelativePointer(item, valueRel), 200),
    }));

    const children: string[] = [];
    const components: unknown[] = [
      {
        children,
        component: "Column",
        id: "root",
      },
    ];

    metrics.forEach((m, index) => {
      const colId = `mcol${index}`;
      const labelId = `ml${index}`;
      const valueId = `mv${index}`;
      children.push(colId);
      components.push({
        children: [labelId, valueId],
        component: "Column",
        id: colId,
      });
      components.push({
        component: "Text",
        id: labelId,
        text: m.label,
        variant: "caption",
      });
      components.push({
        component: "Text",
        id: valueId,
        text: m.value,
        variant: "h3",
      });
    });

    return [
      ...surfaceHeader(surfaceId),
      {
        updateComponents: {
          components,
          surfaceId,
        },
        version: "v0.8",
      },
    ];
  }

  if (plan.ui_kind === "list_cards") {
    const itemsPath = assertBinding(plan, "items");
    const titleRel = assertBinding(plan, "item_title");
    if (!itemsPath || !titleRel) return [];

    const rawItems = getByJsonPointer(rootData, itemsPath);
    if (!Array.isArray(rawItems)) return [];

    const subtitleRel = plan.bindings.item_subtitle;
    const slice = rawItems.slice(0, maxItems);
    const cards = slice.map((item) => ({
      subtitle: subtitleRel ? toDisplayString(getByRelativePointer(item, subtitleRel), 500) : "",
      title: toDisplayString(getByRelativePointer(item, titleRel), 500),
    }));

    const children: string[] = [];
    const components: unknown[] = [
      {
        children,
        component: "Column",
        id: "root",
      },
    ];

    cards.forEach((card, index) => {
      const wrapId = `card${index}`;
      const titleId = `ct${index}`;
      const subId = `cs${index}`;
      const innerChildren = card.subtitle ? [titleId, subId] : [titleId];
      children.push(wrapId);
      components.push({
        children: innerChildren,
        component: "Column",
        id: wrapId,
      });
      components.push({
        component: "Text",
        id: titleId,
        text: card.title,
        variant: "h4",
      });
      if (card.subtitle) {
        components.push({
          component: "Text",
          id: subId,
          text: card.subtitle,
          variant: "caption",
        });
      }
    });

    return [
      ...surfaceHeader(surfaceId),
      {
        updateComponents: {
          components,
          surfaceId,
        },
        version: "v0.8",
      },
    ];
  }

  if (plan.ui_kind === "table") {
    const rowsPath = assertBinding(plan, "rows");
    if (!rowsPath) return [];
    const cols = plan.column_bindings;
    if (!cols?.length) return [];

    const rawRows = getByJsonPointer(rootData, rowsPath);
    if (!Array.isArray(rawRows)) return [];

    const slice = rawRows.slice(0, maxItems);
    const rows = slice.map((row) =>
      cols.map((col) => toDisplayString(getByRelativePointer(row, col.path), 800)),
    );

    const headerLine = cols.map((c) => c.header).join(" | ");
    const bodyLines = rows.map((cells) => cells.join(" | "));
    const tableText = [headerLine, bodyLines.join("\n")].filter(Boolean).join("\n");

    return [
      ...surfaceHeader(surfaceId),
      {
        updateComponents: {
          components: [
            {
              children: ["tbl"],
              component: "Column",
              id: "root",
            },
            {
              component: "Text",
              id: "tbl",
              text: tableText,
              variant: "body",
            },
          ],
          surfaceId,
        },
        version: "v0.8",
      },
    ];
  }

  return [];
};
