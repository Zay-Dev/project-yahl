export const A2UI_PLAN_VERSION = "a2uiPlan.v1" as const;

export const A2UI_PLAN_UI_KINDS = [
  "summary_card",
  "metric_cards",
  "list_cards",
  "detail_card",
  "table",
] as const;

export type A2uiPlanUiKind = (typeof A2UI_PLAN_UI_KINDS)[number];

export type A2uiPlanColumnBinding = {
  header: string;
  kind?: "link" | "text";
  labelPath?: string;
  path: string;
  urlPath?: string;
};

export type A2uiPlanParseIssueCode =
  | "INVALID_PLAN_ROOT"
  | "INVALID_VERSION"
  | "INVALID_SURFACE_ID"
  | "INVALID_UI_KIND"
  | "INVALID_BINDINGS"
  | "INVALID_LIMITS"
  | "TABLE_COLUMN_BINDINGS_REQUIRED"
  | "TABLE_COLUMN_BINDING_INVALID"
  | "TABLE_LINK_COLUMN_URL_PATH_REQUIRED"
  | "LIST_CARDS_BINDINGS_REQUIRED"
  | "CARD_BINDINGS_REQUIRED"
  | "METRIC_BINDINGS_REQUIRED";

export type A2uiPlanParseResult =
  | {
    issueCode: A2uiPlanParseIssueCode;
    message: string;
    ok: false;
  }
  | {
    ok: true;
    plan: A2uiPlanV1;
  };

export type A2uiPlanV1 = {
  bindings: Record<string, string>;
  column_bindings?: A2uiPlanColumnBinding[];
  limits?: { maxItems?: number };
  surfaceId: string;
  ui_kind: A2uiPlanUiKind;
  version: typeof A2UI_PLAN_VERSION;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const unescape = (segment: string) => segment.replace(/~1/g, "/").replace(/~0/g, "~");

export const getByJsonPointer = (root: unknown, pointer: string): unknown => {
  const trimmed = pointer.trim();
  if (trimmed === "" || trimmed === "/") return root;
  if (!trimmed.startsWith("/")) return undefined;

  const segments = trimmed.slice(1).split("/").map(unescape);
  let current: unknown = root;

  for (const segment of segments) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object") return undefined;

    if (Array.isArray(current)) {
      const index = Number.parseInt(segment, 10);
      if (!Number.isFinite(index) || index < 0 || index >= current.length) return undefined;
      current = current[index];
      continue;
    }

    if (!Object.prototype.hasOwnProperty.call(current, segment)) return undefined;
    current = (current as Record<string, unknown>)[segment];
  }

  return current;
};

const getByRelativePointer = (item: unknown, pointer: string): unknown => {
  const p = pointer.trim();
  if (!p || p === "/") return item;
  if (!p.startsWith("/")) return undefined;
  return getByJsonPointer(item, p);
};

const isUiKind = (value: unknown): value is A2uiPlanUiKind =>
  typeof value === "string" && (A2UI_PLAN_UI_KINDS as readonly string[]).includes(value);

const parseColumnBindings = (
  raw: unknown,
): { error?: { code: A2uiPlanParseIssueCode; message: string }; value?: A2uiPlanColumnBinding[] } => {
  if (raw === undefined) return {};
  if (!Array.isArray(raw)) {
    return {
      error: {
        code: "TABLE_COLUMN_BINDING_INVALID",
        message: "column_bindings must be an array",
      },
    };
  }

  const out: A2uiPlanColumnBinding[] = [];

  for (const row of raw) {
    if (!isRecord(row)) {
      return {
        error: {
          code: "TABLE_COLUMN_BINDING_INVALID",
          message: "column_bindings items must be objects",
        },
      };
    }

    const header = typeof row.header === "string" ? row.header.trim() : "";
    const path = typeof row.path === "string" ? row.path.trim() : "";
    const kindRaw = typeof row.kind === "string" ? row.kind.trim() : "";
    const kind = kindRaw === "link" ? "link" : "text";
    const urlPath = typeof row.urlPath === "string" ? row.urlPath.trim() : "";
    const labelPath = typeof row.labelPath === "string" ? row.labelPath.trim() : "";

    if (!header || !path.startsWith("/")) {
      return {
        error: {
          code: "TABLE_COLUMN_BINDING_INVALID",
          message: "column_bindings requires non-empty header and /path",
        },
      };
    }

    if (kind === "link" && !urlPath.startsWith("/")) {
      return {
        error: {
          code: "TABLE_LINK_COLUMN_URL_PATH_REQUIRED",
          message: "link column requires urlPath as JSON pointer",
        },
      };
    }

    if (labelPath && !labelPath.startsWith("/")) {
      return {
        error: {
          code: "TABLE_COLUMN_BINDING_INVALID",
          message: "labelPath must be a JSON pointer",
        },
      };
    }

    out.push({
      header,
      kind,
      labelPath: labelPath || undefined,
      path,
      urlPath: urlPath || undefined,
    });
  }

  return { value: out.length ? out : undefined };
};

const parseBindings = (raw: unknown): Record<string, string> | null => {
  if (!isRecord(raw)) return null;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value !== "string") return null;
    const v = value.trim();
    if (v !== "/" && !v.startsWith("/")) return null;
    out[key] = v;
  }
  return out;
};

export const parseA2uiPlanV1Detailed = (raw: unknown): A2uiPlanParseResult => {
  if (!isRecord(raw)) {
    return { issueCode: "INVALID_PLAN_ROOT", message: "plan must be an object", ok: false };
  }
  if (raw.version !== A2UI_PLAN_VERSION) {
    return { issueCode: "INVALID_VERSION", message: "plan.version must be a2uiPlan.v1", ok: false };
  }
  if (typeof raw.surfaceId !== "string" || !raw.surfaceId.trim()) {
    return { issueCode: "INVALID_SURFACE_ID", message: "surfaceId is required", ok: false };
  }
  if (!isUiKind(raw.ui_kind)) {
    return { issueCode: "INVALID_UI_KIND", message: "ui_kind is invalid", ok: false };
  }

  const bindings = parseBindings(raw.bindings);
  if (!bindings) {
    return { issueCode: "INVALID_BINDINGS", message: "bindings must be JSON pointers", ok: false };
  }

  const limits = isRecord(raw.limits) && typeof raw.limits.maxItems === "number" &&
      Number.isFinite(raw.limits.maxItems) &&
      raw.limits.maxItems > 0
    ? { maxItems: Math.min(200, Math.floor(raw.limits.maxItems)) }
    : undefined;
  if (raw.limits !== undefined && !limits) {
    return { issueCode: "INVALID_LIMITS", message: "limits.maxItems must be a positive number", ok: false };
  }

  const parsedColumns = parseColumnBindings(raw.column_bindings);
  if (parsedColumns.error) {
    return { issueCode: parsedColumns.error.code, message: parsedColumns.error.message, ok: false };
  }
  const column_bindings = parsedColumns.value;

  const ui_kind = raw.ui_kind;
  if (ui_kind === "table" && (!column_bindings?.length)) {
    return {
      issueCode: "TABLE_COLUMN_BINDINGS_REQUIRED",
      message: "table requires column_bindings",
      ok: false,
    };
  }
  if (ui_kind === "list_cards" && (!bindings.items || !bindings.item_title)) {
    return {
      issueCode: "LIST_CARDS_BINDINGS_REQUIRED",
      message: "list_cards requires items and item_title bindings",
      ok: false,
    };
  }
  if ((ui_kind === "summary_card" || ui_kind === "detail_card") && (!bindings.title || !bindings.body)) {
    return {
      issueCode: "CARD_BINDINGS_REQUIRED",
      message: "summary_card/detail_card requires title and body bindings",
      ok: false,
    };
  }
  if (ui_kind === "metric_cards" && !bindings.items) {
    return {
      issueCode: "METRIC_BINDINGS_REQUIRED",
      message: "metric_cards requires items binding",
      ok: false,
    };
  }

  return {
    ok: true,
    plan: {
      bindings,
      column_bindings,
      limits,
      surfaceId: raw.surfaceId.trim(),
      ui_kind,
      version: A2UI_PLAN_VERSION,
    },
  };
};

export const parseA2uiPlanV1 = (raw: unknown): A2uiPlanV1 | null => {
  const parsed = parseA2uiPlanV1Detailed(raw);
  return parsed.ok ? parsed.plan : null;
};

export const toDisplayString = (value: unknown, maxLen = 4000): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.length > maxLen ? `${value.slice(0, maxLen)}…` : value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    const s = JSON.stringify(value);
    return s.length > maxLen ? `${s.slice(0, maxLen)}…` : s;
  } catch {
    return "";
  }
};

export const resolvePlanMaxItems = (plan: A2uiPlanV1) => {
  const raw = plan.limits?.maxItems;
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return Math.min(200, Math.floor(raw));
  return 50;
};

export { getByRelativePointer };
