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
  path: string;
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

const parseColumnBindings = (raw: unknown): A2uiPlanColumnBinding[] | undefined => {
  if (!Array.isArray(raw)) return undefined;
  const out: A2uiPlanColumnBinding[] = [];
  for (const row of raw) {
    if (!isRecord(row)) continue;
    const header = typeof row.header === "string" ? row.header.trim() : "";
    const path = typeof row.path === "string" ? row.path.trim() : "";
    if (!header || !path.startsWith("/")) continue;
    out.push({ header, path });
  }
  return out.length ? out : undefined;
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

export const parseA2uiPlanV1 = (raw: unknown): A2uiPlanV1 | null => {
  if (!isRecord(raw)) return null;
  if (raw.version !== A2UI_PLAN_VERSION) return null;
  if (typeof raw.surfaceId !== "string" || !raw.surfaceId.trim()) return null;
  if (!isUiKind(raw.ui_kind)) return null;

  const bindings = parseBindings(raw.bindings);
  if (!bindings) return null;

  const limits = isRecord(raw.limits) && typeof raw.limits.maxItems === "number" &&
      Number.isFinite(raw.limits.maxItems) &&
      raw.limits.maxItems > 0
    ? { maxItems: Math.min(200, Math.floor(raw.limits.maxItems)) }
    : undefined;

  const column_bindings = parseColumnBindings(raw.column_bindings);

  const ui_kind = raw.ui_kind;
  if (ui_kind === "table" && (!column_bindings?.length)) return null;
  if (ui_kind === "list_cards" && (!bindings.items || !bindings.item_title)) return null;
  if ((ui_kind === "summary_card" || ui_kind === "detail_card") && (!bindings.title || !bindings.body)) {
    return null;
  }
  if (ui_kind === "metric_cards" && !bindings.items) return null;

  return {
    bindings,
    column_bindings,
    limits,
    surfaceId: raw.surfaceId.trim(),
    ui_kind,
    version: A2UI_PLAN_VERSION,
  };
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
