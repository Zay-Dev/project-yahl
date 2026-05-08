export type ParsedNode =
  | { childIds: string[]; id: string; kind: "column" }
  | { id: string; kind: "text"; text: string; variant?: string };

export type A2uiPreviewModel = {
  nodes: Map<string, ParsedNode>;
  surfaceId?: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const parseComponent = (raw: unknown): ParsedNode | null => {
  if (!isRecord(raw)) return null;
  const id = typeof raw.id === "string" ? raw.id.trim() : "";
  if (!id) return null;
  const component = typeof raw.component === "string" ? raw.component.trim() : "";

  if (component === "Column") {
    const children = Array.isArray(raw.children)
      ? raw.children.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : [];
    return { childIds: children, id, kind: "column" };
  }

  if (component === "Text") {
    const text = typeof raw.text === "string" ? raw.text : "";
    const variant = typeof raw.variant === "string" ? raw.variant : undefined;
    return { id, kind: "text", text, variant };
  }

  return null;
};

export const buildA2uiPreviewModel = (value: unknown): A2uiPreviewModel | null => {
  if (!Array.isArray(value)) return null;

  const nodes = new Map<string, ParsedNode>();
  let surfaceId = "";

  for (const envelope of value) {
    if (!isRecord(envelope) || envelope.version !== "v0.8") continue;

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
        const parsed = parseComponent(item);
        if (parsed) nodes.set(parsed.id, parsed);
      }
    }
  }

  const root = nodes.get("root");
  if (!root || root.kind !== "column") return null;

  return { nodes, surfaceId: surfaceId || undefined };
};
