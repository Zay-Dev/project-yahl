import type { TYahlFragment, TYahlStage } from './types';
import { validateYahlStage } from './validate-stage';

export type TValidateFragmentOptions = {
  allowNestedLogic?: boolean;
};

export const validateYahlFragment = (
  raw: unknown,
  label = 'logic',
  options: TValidateFragmentOptions = {},
): TYahlFragment => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`${label}: expected a YAML mapping with stages`);
  }

  const doc = raw as Record<string, unknown>;

  if (doc.name !== undefined || doc.description !== undefined) {
    throw new Error(`${label}: fragment must not set name or description`);
  }

  if (!Array.isArray(doc.stages) || doc.stages.length === 0) {
    throw new Error(`${label}.stages: required non-empty array`);
  }

  if (doc.types !== undefined && typeof doc.types !== 'string') {
    throw new Error(`${label}.types: must be a string when present`);
  }

  const allowNestedLogic = options.allowNestedLogic === true;

  const stages: TYahlStage[] = doc.stages.map((stage, index) =>
    validateYahlStage(stage, index, {
      allowNestedLogic,
      labelPrefix: `${label}.stages`,
      nested: true,
    }));

  return {
    stages,
    ...(typeof doc.types === 'string' && doc.types.trim()
      ? { types: doc.types.trim() }
      : {}),
  };
};
