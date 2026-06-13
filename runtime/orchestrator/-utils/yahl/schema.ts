import type { YahlStage } from "@/shared/yahl-stage";
import { validateYahlStage } from "@/shared/yahl-stage";

export type { YahlStage } from "@/shared/yahl-stage";

export interface YahlDocument {
  description: string;
  name: string;
  resultContextKey?: string;
  stages: YahlStage[];
  types?: string;
}

export const validateYahlDocument = (raw: unknown): YahlDocument => {
  if (!raw || typeof raw !== "object") {
    throw new Error("YAHL document: expected a YAML mapping");
  }

  const doc = raw as Record<string, unknown>;

  if (typeof doc.name !== "string" || !doc.name.trim()) {
    throw new Error("name: required non-empty string");
  }

  if (typeof doc.description !== "string" || !doc.description.trim()) {
    throw new Error("description: required non-empty string");
  }

  if (!Array.isArray(doc.stages) || doc.stages.length === 0) {
    throw new Error("stages: required non-empty array");
  }

  if (doc.types !== undefined && typeof doc.types !== "string") {
    throw new Error("types: must be a string when present");
  }

  if (doc.resultContextKey !== undefined && typeof doc.resultContextKey !== "string") {
    throw new Error("resultContextKey: must be a string when present");
  }

  const resultContextKey = typeof doc.resultContextKey === "string"
    ? doc.resultContextKey.trim()
    : "";

  if (doc.resultContextKey !== undefined && !resultContextKey) {
    throw new Error("resultContextKey: must be a non-empty string when present");
  }

  return {
    description: doc.description.trim(),
    name: doc.name.trim(),
    stages: doc.stages.map((stage, index) => validateYahlStage(stage, index)),
    ...(resultContextKey ? { resultContextKey } : {}),
    ...(typeof doc.types === "string" && doc.types.trim()
      ? { types: doc.types.trim() }
      : {}),
  };
};
