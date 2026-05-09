import { A2UI_PLAN_UI_KINDS } from "../../shared/a2ui-plan";

export type A2uiTranslatorInput = {
  allowedUiKinds?: readonly string[];
  dataRef: {
    key: string;
    scope: string;
  };
  schemaSummary?: string;
};

export const buildA2uiTranslatorUserMessage = (input: A2uiTranslatorInput) => {
  const kinds = input.allowedUiKinds?.length
    ? input.allowedUiKinds.join(", ")
    : A2UI_PLAN_UI_KINDS.join(", ");

  return [
    "You map structured runtime data to a minimal a2uiPlan.v1 JSON object.",
    "Rules:",
    "- Output a single JSON object only (no markdown fence, no prose).",
    "- version must be \"a2uiPlan.v1\".",
    "- ui_kind must be one of: " + kinds + ".",
    "- bindings values must be JSON Pointer strings starting with / (use / for document root).",
    "- Do not embed large data literals; only pointers and short headers.",
    "- surfaceId must be unique for distinct sections/component trees. Reuse same surfaceId only for continuation updates of the same UI kind.",
    "- For ui_kind \"table\", include column_bindings: [{\"header\":\"...\",\"path\":\"/field\"}] with paths relative to each row object.",
    "- Never serialize table headers/rows into a single pipe-delimited text block (for example \"A | B | C\").",
    "- For \"list_cards\", bindings must include items and item_title (item_subtitle optional).",
    "- For \"summary_card\" or \"detail_card\", bindings must include title and body.",
    "- For \"metric_cards\", bindings must include items; optional item_label and item_value (defaults /label and /value).",
    "- Component selection for markdown data: full markdown document -> summary_card/detail_card; repeated section array -> list_cards; numeric KPI array -> metric_cards; row arrays -> table.",
    "- Markdown decomposition: if markdown is already finalized in one field (for example /brief_markdown), bind it directly as body; only decompose when structured arrays/rows already exist in data.",
    "- Never invent synthetic parsed arrays in plan. Bindings must point to existing dataRef content only.",
    "- Optional limits: {\"maxItems\": number} (server caps at 200).",
    "",
    "dataRef: " + JSON.stringify(input.dataRef),
    input.schemaSummary ? `schemaSummary: ${input.schemaSummary}` : "",
  ]
    .filter(Boolean)
    .join("\n");
};

export const buildA2uiTranslatorSystemMessage = () =>
  "You are a compact UI-plan translator. Respond with JSON only.";
