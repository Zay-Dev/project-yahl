import type {
  TYahlFragment,
  TYahlLogic,
  TYahlLogicRef,
  TYahlStage,
} from './types';

export const NESTED_LOGIC_PLACEHOLDER = '{ /* nested yahl */ }';

export const MAX_YAHL_REF_DEPTH = 3;

export const YAHL_REF_EXTENSIONS = ['.yahl', '.yaml', '.yml'] as const;

export const isYahlLogicRef = (value: unknown): value is TYahlLogicRef => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const keys = Object.keys(value);

  return keys.length === 1 && keys[0] === '$ref' && typeof (value as TYahlLogicRef).$ref === 'string';
};

export const isYahlFragment = (value: unknown): value is TYahlFragment => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  if (isYahlLogicRef(value)) {
    return false;
  }

  return Array.isArray((value as TYahlFragment).stages);
};

export const isNestedLogic = (value: unknown): value is TYahlFragment | TYahlLogicRef =>
  isYahlLogicRef(value) || isYahlFragment(value);

export const asLogicScript = (logic: TYahlLogic, label = 'logic'): string => {
  if (typeof logic === 'string') {
    return logic;
  }

  throw new Error(`${label}: expected string logic`);
};

export const logicPreviewText = (logic: TYahlLogic | undefined): string => {
  if (logic === undefined) {
    return '';
  }

  if (typeof logic === 'string') {
    return logic;
  }

  if (isYahlLogicRef(logic)) {
    return `$ref: ${logic.$ref}`;
  }

  return `stages[${logic.stages.length}]`;
};

export const resolveMainThreadFlag = (
  stage: Pick<TYahlStage, 'mainThread'>,
): boolean => stage.mainThread === true;

export const assertSafeYahlRefPath = (raw: string, label: string): string => {
  const path = raw.trim();

  if (!path) {
    throw new Error(`${label}.$ref: required non-empty string`);
  }

  if (path.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(path)) {
    throw new Error(`${label}.$ref: absolute paths are not allowed`);
  }

  if (path.includes('://') || path.includes('\\')) {
    throw new Error(`${label}.$ref: invalid path`);
  }

  const parts = path.split('/');

  if (parts.some((part) => part === '..' || part === '')) {
    throw new Error(`${label}.$ref: path must be relative without ".."`);
  }

  const lower = path.toLowerCase();
  const allowed = YAHL_REF_EXTENSIONS.some((ext) => lower.endsWith(ext));

  if (!allowed) {
    throw new Error(
      `${label}.$ref: must end with ${YAHL_REF_EXTENSIONS.join(', ')}`,
    );
  }

  return path;
};
