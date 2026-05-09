import { parseA2uiPreview } from "./a2ui-preview-parse";
import type { A2uiPreviewModel } from "./a2ui-preview-model";

export type { A2uiPreviewDiagnostics, A2uiPreviewModel, ParsedNode } from "./a2ui-preview-model";

export const buildA2uiPreviewModel = parseA2uiPreview;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const getSurfaceId = (envelope: unknown): string | null => {
  if (!isRecord(envelope)) return null;
  if ("createSurface" in envelope && isRecord(envelope.createSurface)) {
    const surfaceId = envelope.createSurface.surfaceId;
    return typeof surfaceId === "string" && surfaceId.trim() ? surfaceId.trim() : null;
  }
  if ("updateComponents" in envelope && isRecord(envelope.updateComponents)) {
    const surfaceId = envelope.updateComponents.surfaceId;
    return typeof surfaceId === "string" && surfaceId.trim() ? surfaceId.trim() : null;
  }
  if ("updateDataModel" in envelope && isRecord(envelope.updateDataModel)) {
    const surfaceId = envelope.updateDataModel.surfaceId;
    return typeof surfaceId === "string" && surfaceId.trim() ? surfaceId.trim() : null;
  }
  return null;
};

export const splitA2uiEnvelopesBySurface = (value: unknown): Array<{ envelopes: unknown[]; surfaceId: string }> => {
  if (!Array.isArray(value)) return [];
  const grouped = new Map<string, unknown[]>();

  value.forEach((envelope) => {
    const surfaceId = getSurfaceId(envelope);
    if (!surfaceId) return;
    const next = grouped.get(surfaceId) || [];
    next.push(envelope);
    grouped.set(surfaceId, next);
  });

  return Array.from(grouped.entries()).map(([surfaceId, envelopes]) => ({ envelopes, surfaceId }));
};

export const buildA2uiPreviewModels = (value: unknown): Array<{ model: A2uiPreviewModel; surfaceId: string }> =>
  splitA2uiEnvelopesBySurface(value)
    .map(({ envelopes, surfaceId }) => ({
      model: parseA2uiPreview(envelopes),
      surfaceId,
    }))
    .filter((item): item is { model: A2uiPreviewModel; surfaceId: string } => !!item.model);
