export type A2uiNodeKind =
  | "button"
  | "card"
  | "checkbox"
  | "choice_picker"
  | "column"
  | "date_time_input"
  | "divider"
  | "icon"
  | "image"
  | "list"
  | "modal"
  | "row"
  | "slider"
  | "tabs"
  | "text"
  | "text_field";

export type ParsedNode =
  | { actionUrl?: string; childId?: string; id: string; kind: "button"; label?: string; variant?: string }
  | { childId?: string; id: string; kind: "card" }
  | { id: string; kind: "checkbox"; label?: string; value?: boolean }
  | {
    id: string;
    kind: "choice_picker";
    maxAllowedSelections?: number;
    options: Array<{ label: string; value: string }>;
    selectionValues: string[];
  }
  | { childIds: string[]; id: string; kind: "column" | "list" | "row" }
  | { enableDate?: boolean; enableTime?: boolean; id: string; kind: "date_time_input"; value?: string }
  | { axis?: "horizontal" | "vertical"; id: string; kind: "divider" }
  | { id: string; kind: "icon"; name?: string }
  | { fit?: string; id: string; kind: "image"; url?: string }
  | { contentChildId?: string; entryPointChildId?: string; id: string; kind: "modal" }
  | { id: string; kind: "slider"; maxValue?: number; minValue?: number; value?: number }
  | { id: string; items: Array<{ childId: string; title: string }>; kind: "tabs" }
  | { id: string; kind: "text"; text: string; variant?: string }
  | { id: string; kind: "text_field"; label?: string; textFieldType?: string; validationRegexp?: string; value?: string };

export type A2uiPreviewDiagnostics = {
  malformedComponentCount: number;
  missingRoot: boolean;
  parseErrors: string[];
  supportedComponentCount: number;
  unsupportedComponentCount: number;
  unsupportedComponentNames: Record<string, number>;
  unsupportedVersionCount: number;
  versionCounts: Record<string, number>;
};

export type A2uiPreviewModel = {
  diagnostics: A2uiPreviewDiagnostics;
  nodes: Map<string, ParsedNode>;
  rootId: string;
  surfaceId?: string;
};

export const createDiagnostics = (): A2uiPreviewDiagnostics => ({
  malformedComponentCount: 0,
  missingRoot: false,
  parseErrors: [],
  supportedComponentCount: 0,
  unsupportedComponentCount: 0,
  unsupportedComponentNames: {},
  unsupportedVersionCount: 0,
  versionCounts: {},
});

export const withDefaultRoot = (model: Omit<A2uiPreviewModel, "rootId">): A2uiPreviewModel => ({
  ...model,
  rootId: "root",
});
