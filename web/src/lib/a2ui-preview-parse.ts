import type { A2uiPreviewModel, ParsedNode } from "./a2ui-preview-model";

import { createDiagnostics, withDefaultRoot } from "./a2ui-preview-model";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const asString = (value: unknown) => typeof value === "string" ? value : undefined;
const getOpenUrlAction = (value: unknown): string | undefined => {
  if (!isRecord(value)) return undefined;
  const topType = asString(value.type);
  if (topType && topType !== "open_url") return undefined;
  const openUrl = value.open_url;
  if (!isRecord(openUrl)) return undefined;
  const url = asString(openUrl.url)?.trim();
  return url || undefined;
};

const toStringValue = (value: unknown): string | undefined => {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (isRecord(value)) {
    if (typeof value.literalString === "string") return value.literalString;
    if (typeof value.path === "string") return `{${value.path}}`;
    if (typeof value.literalNumber === "number") return String(value.literalNumber);
    if (typeof value.literalBoolean === "boolean") return String(value.literalBoolean);
  }
  return undefined;
};

const toNumberValue = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (isRecord(value) && typeof value.literalNumber === "number" && Number.isFinite(value.literalNumber)) {
    return value.literalNumber;
  }
  return undefined;
};

const toBooleanValue = (value: unknown): boolean | undefined => {
  if (typeof value === "boolean") return value;
  if (isRecord(value) && typeof value.literalBoolean === "boolean") return value.literalBoolean;
  return undefined;
};

const getChildIds = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  }
  if (isRecord(value) && Array.isArray(value.explicitList)) {
    return value.explicitList.filter(
      (item): item is string => typeof item === "string" && item.trim().length > 0,
    );
  }
  return [];
};

const getComponentTypeAndProps = (raw: Record<string, unknown>) => {
  if (typeof raw.component === "string") return { props: raw, type: raw.component.trim() };
  if (isRecord(raw.component)) {
    const entries = Object.entries(raw.component);
    if (entries.length !== 1) return null;
    const [type, props] = entries[0];
    if (!isRecord(props)) return null;
    return { props, type: type.trim() };
  }
  return null;
};

const parseComponent = (
  raw: unknown,
  diagnostics: ReturnType<typeof createDiagnostics>,
): ParsedNode | null => {
  if (!isRecord(raw)) {
    diagnostics.malformedComponentCount += 1;
    return null;
  }

  const id = typeof raw.id === "string" ? raw.id.trim() : "";
  if (!id) {
    diagnostics.malformedComponentCount += 1;
    return null;
  }

  const parsed = getComponentTypeAndProps(raw);
  if (!parsed?.type) {
    diagnostics.malformedComponentCount += 1;
    return null;
  }

  const component = parsed.type;
  const props = parsed.props;

  if (component === "Row" || component === "Column" || component === "List") {
    const kind = component.toLowerCase() as "column" | "list" | "row";
    const childIds = getChildIds(props.children);
    diagnostics.supportedComponentCount += 1;
    return { childIds, id, kind };
  }

  if (component === "Text") {
    const text = toStringValue(props.text) ?? "";
    const variant = asString(props.variant) ?? asString(props.usageHint);
    diagnostics.supportedComponentCount += 1;
    return { id, kind: "text", text, variant };
  }

  if (component === "Image") {
    const url = toStringValue(props.url);
    const fit = asString(props.fit);
    diagnostics.supportedComponentCount += 1;
    return { fit, id, kind: "image", url };
  }

  if (component === "Icon") {
    const name = toStringValue(props.name);
    diagnostics.supportedComponentCount += 1;
    return { id, kind: "icon", name };
  }

  if (component === "Divider") {
    const axisRaw = asString(props.axis);
    const axis = axisRaw === "vertical" ? "vertical" : "horizontal";
    diagnostics.supportedComponentCount += 1;
    return { axis, id, kind: "divider" };
  }

  if (component === "Button") {
    const childId = asString(props.child);
    const variant = asString(props.variant) ?? (props.primary === true ? "primary" : undefined);
    const label = toStringValue(props.label);
    const actionUrl = getOpenUrlAction(props.action);
    diagnostics.supportedComponentCount += 1;
    return { actionUrl, childId, id, kind: "button", label, variant };
  }

  if (component === "TextField") {
    const label = toStringValue(props.label);
    const value = toStringValue(props.value) ?? toStringValue(props.text);
    const textFieldType = asString(props.textFieldType);
    const validationRegexp = asString(props.validationRegexp);
    diagnostics.supportedComponentCount += 1;
    return { id, kind: "text_field", label, textFieldType, validationRegexp, value };
  }

  if (component === "CheckBox") {
    const label = toStringValue(props.label);
    const value = toBooleanValue(props.value);
    diagnostics.supportedComponentCount += 1;
    return { id, kind: "checkbox", label, value };
  }

  if (component === "Slider") {
    const value = toNumberValue(props.value);
    const minValue = toNumberValue(props.minValue);
    const maxValue = toNumberValue(props.maxValue);
    diagnostics.supportedComponentCount += 1;
    return { id, kind: "slider", maxValue, minValue, value };
  }

  if (component === "DateTimeInput") {
    const value = toStringValue(props.value);
    const enableDate = toBooleanValue(props.enableDate);
    const enableTime = toBooleanValue(props.enableTime);
    diagnostics.supportedComponentCount += 1;
    return { enableDate, enableTime, id, kind: "date_time_input", value };
  }

  if (component === "ChoicePicker" || component === "MultipleChoice") {
    const optionsRaw = Array.isArray(props.options) ? props.options : [];
    const options = optionsRaw.flatMap((option): Array<{ label: string; value: string }> => {
      if (!isRecord(option)) return [];
      const label = toStringValue(option.label);
      const value = toStringValue(option.value);
      if (!label || !value) return [];
      return [{ label, value }];
    });
    const maxAllowedSelections = toNumberValue(props.maxAllowedSelections);
    const selectionsRaw = props.selectionValues ?? props.selections ?? props.value;
    const selectionValues = Array.isArray(selectionsRaw)
      ? selectionsRaw.filter((item): item is string => typeof item === "string")
      : [];
    diagnostics.supportedComponentCount += 1;
    return { id, kind: "choice_picker", maxAllowedSelections, options, selectionValues };
  }

  if (component === "Card") {
    const childId = asString(props.child);
    diagnostics.supportedComponentCount += 1;
    return { childId, id, kind: "card" };
  }

  if (component === "Modal") {
    const entryPointChildId = asString(props.entryPointChild) ?? asString(props.entryChild);
    const contentChildId = asString(props.contentChild);
    diagnostics.supportedComponentCount += 1;
    return { contentChildId, entryPointChildId, id, kind: "modal" };
  }

  if (component === "Tabs") {
    const tabItems = Array.isArray(props.tabItems) ? props.tabItems : [];
    const items = tabItems.flatMap((item): Array<{ childId: string; title: string }> => {
      if (!isRecord(item)) return [];
      const childId = asString(item.child);
      const title = toStringValue(item.title);
      if (!childId || !title) return [];
      return [{ childId, title }];
    });
    diagnostics.supportedComponentCount += 1;
    return { id, items, kind: "tabs" };
  }

  diagnostics.unsupportedComponentCount += 1;
  diagnostics.unsupportedComponentNames[component] = (diagnostics.unsupportedComponentNames[component] ?? 0) + 1;
  return null;
};

const parseV08 = (value: unknown): A2uiPreviewModel | null => {
  if (!Array.isArray(value)) return null;

  const nodes = new Map<string, ParsedNode>();
  const diagnostics = createDiagnostics();
  let surfaceId = "";

  for (const envelope of value) {
    if (!isRecord(envelope)) continue;
    diagnostics.versionCounts["v0.8"] = (diagnostics.versionCounts["v0.8"] ?? 0) + 1;

    if ("createSurface" in envelope && isRecord(envelope.createSurface)) {
      const sid = envelope.createSurface.surfaceId;
      if (typeof sid === "string" && sid.trim()) surfaceId = sid.trim();
      continue;
    }

    if ("updateDataModel" in envelope) continue;

    if ("updateComponents" in envelope && isRecord(envelope.updateComponents)) {
      const uc = envelope.updateComponents;
      const sid = typeof uc.surfaceId === "string" && uc.surfaceId.trim() ? uc.surfaceId.trim() : surfaceId;
      surfaceId = sid;
      const components = uc.components;
      if (!Array.isArray(components)) continue;
      for (const item of components) {
        const node = parseComponent(item, diagnostics);
        if (node) nodes.set(node.id, node);
      }
    }
  }

  const root = nodes.get("root");
  if (!root || (root.kind !== "column" && root.kind !== "row" && root.kind !== "list")) {
    diagnostics.missingRoot = true;
    return withDefaultRoot({ diagnostics, nodes, surfaceId: surfaceId || undefined });
  }

  return withDefaultRoot({ diagnostics, nodes, surfaceId: surfaceId || undefined });
};

// Version dispatcher seam: keep v0.8 parser isolated so v0.9 can plug in
// through this function without changing renderer/model contracts.
export const parseA2uiPreview = (value: unknown): A2uiPreviewModel | null => {
  if (!Array.isArray(value)) return null;
  let hasV08 = false;
  const diagnostics = createDiagnostics();

  for (const envelope of value) {
    if (!isRecord(envelope)) continue;
    const version = asString(envelope.version) ?? "unknown";
    diagnostics.versionCounts[version] = (diagnostics.versionCounts[version] ?? 0) + 1;
    if (version === "v0.8") hasV08 = true;
    else diagnostics.unsupportedVersionCount += 1;
  }

  if (!hasV08) return null;

  const parsed = parseV08(value);
  if (!parsed) return null;
  parsed.diagnostics.unsupportedVersionCount = diagnostics.unsupportedVersionCount;
  parsed.diagnostics.versionCounts = diagnostics.versionCounts;
  if (parsed.diagnostics.unsupportedVersionCount > 0) {
    parsed.diagnostics.parseErrors.push("Detected non-v0.8 envelopes. They are ignored in preview.");
    parsed.diagnostics.parseErrors.push("TODO(v0.9): add parseV09 and map it into the same preview model.");
  }
  return parsed;
};
