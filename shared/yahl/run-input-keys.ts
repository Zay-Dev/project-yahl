import YAML from 'yaml';

export type TRunInputFieldType = 'text' | 'textarea' | 'enum';

export type TRunInputField = {
  default?: string;
  key: string;
  options?: string[];
  type: TRunInputFieldType;
};

const RUN_INPUT_FIELD_TYPES = new Set<TRunInputFieldType>(['text', 'textarea', 'enum']);

const parseFieldOptions = (raw: unknown, index: number): string[] => {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error(`runInput[${index}].options: required non-empty array for type enum`);
  }

  const options: string[] = [];
  const seen = new Set<string>();

  for (const [optionIndex, entry] of raw.entries()) {
    if (typeof entry !== 'string' || !entry.trim()) {
      throw new Error(`runInput[${index}].options[${optionIndex}]: must be a non-empty string`);
    }

    const option = entry.trim();

    if (seen.has(option)) {
      throw new Error(`runInput[${index}].options: duplicate option "${option}"`);
    }

    seen.add(option);
    options.push(option);
  }

  return options;
};

const parseFieldObject = (entry: Record<string, unknown>, index: number): TRunInputField => {
  if (typeof entry.key !== 'string' || !entry.key.trim()) {
    throw new Error(`runInput[${index}].key: required non-empty string`);
  }

  const key = entry.key.trim();

  if (typeof entry.type !== 'string' || !RUN_INPUT_FIELD_TYPES.has(entry.type as TRunInputFieldType)) {
    throw new Error(`runInput[${index}].type: must be "text", "textarea", or "enum"`);
  }

  const type = entry.type as TRunInputFieldType;
  const field: TRunInputField = { key, type };

  if (type === 'enum') {
    field.options = parseFieldOptions(entry.options, index);
  } else if (entry.options !== undefined) {
    throw new Error(`runInput[${index}].options: only allowed when type is enum`);
  }

  if (entry.default !== undefined) {
    if (typeof entry.default !== 'string') {
      throw new Error(`runInput[${index}].default: must be a string when present`);
    }

    const defaultValue = entry.default;

    if (type === 'enum' && field.options && !field.options.includes(defaultValue)) {
      throw new Error(`runInput[${index}].default: must be one of options`);
    }

    field.default = defaultValue;
  }

  const allowed = new Set(['key', 'type', 'default', 'options']);
  const unknown = Object.keys(entry).filter((name) => !allowed.has(name));

  if (unknown.length > 0) {
    throw new Error(`runInput[${index}]: unknown keys: ${unknown.join(', ')}`);
  }

  return field;
};

export const parseRunInputFields = (raw: unknown): TRunInputField[] | undefined => {
  if (raw === undefined) {
    return undefined;
  }

  if (!Array.isArray(raw)) {
    throw new Error('runInput: must be an array when present');
  }

  const fields: TRunInputField[] = [];
  const seen = new Set<string>();

  for (const [index, entry] of raw.entries()) {
    let field: TRunInputField;

    if (typeof entry === 'string') {
      if (!entry.trim()) {
        throw new Error(`runInput[${index}]: must be a non-empty string`);
      }

      field = { key: entry.trim(), type: 'text' };
    } else if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      field = parseFieldObject(entry as Record<string, unknown>, index);
    } else {
      throw new Error(`runInput[${index}]: must be a string or field object`);
    }

    if (seen.has(field.key)) {
      throw new Error(`runInput: duplicate key "${field.key}"`);
    }

    seen.add(field.key);
    fields.push(field);
  }

  return fields.length > 0 ? fields : undefined;
};

export const runInputKeysOf = (fields: TRunInputField[] | undefined): string[] | undefined => {
  if (!fields?.length) {
    return undefined;
  }

  return fields.map((field) => field.key);
};

export const parseRunInputContextKeys = (raw: unknown): string[] | undefined =>
  runInputKeysOf(parseRunInputFields(raw));

export const parseRunInputFieldsFromYahl = (yahl: string): TRunInputField[] | undefined => {
  const parsed = YAML.parse(yahl);

  if (!parsed || typeof parsed !== 'object') {
    return undefined;
  }

  return parseRunInputFields((parsed as Record<string, unknown>).runInput);
};

export const parseRunInputKeysFromYahl = (yahl: string): string[] | undefined =>
  runInputKeysOf(parseRunInputFieldsFromYahl(yahl));

export type TRunInputValidation =
  | { ok: true }
  | { ok: false; message: string };

export const applyRunInputDefaults = (
  runInput: Record<string, unknown> | undefined,
  fields: TRunInputField[] | undefined,
): Record<string, unknown> | undefined => {
  if (!fields?.length) {
    return runInput;
  }

  const merged: Record<string, unknown> = { ...(runInput ?? {}) };

  for (const field of fields) {
    if (field.default === undefined) {
      continue;
    }

    const current = merged[field.key];
    const blank = current === undefined
      || current === null
      || (typeof current === 'string' && !current.trim());

    if (blank) {
      merged[field.key] = field.default;
    }
  }

  return Object.keys(merged).length > 0 ? merged : undefined;
};

export const validateRunInputPayload = (
  runInput: Record<string, unknown> | undefined,
  fieldsOrKeys: TRunInputField[] | string[] | undefined,
): TRunInputValidation => {
  const input = runInput ?? {};
  const inputKeys = Object.keys(input);

  if (!fieldsOrKeys?.length) {
    if (inputKeys.length > 0) {
      return { ok: false, message: 'Task does not accept runInput' };
    }

    return { ok: true };
  }

  const fields = typeof fieldsOrKeys[0] === 'string'
    ? (fieldsOrKeys as string[]).map((key): TRunInputField => ({ key, type: 'text' }))
    : fieldsOrKeys as TRunInputField[];

  const allow = new Set(fields.map((field) => field.key));
  const unknown = inputKeys.filter((key) => !allow.has(key));

  if (unknown.length > 0) {
    return { ok: false, message: `Unknown runInput keys: ${unknown.join(', ')}` };
  }

  for (const field of fields) {
    if (field.type !== 'enum' || !field.options?.length) {
      continue;
    }

    const value = input[field.key];

    if (value === undefined || value === null) {
      continue;
    }

    if (typeof value !== 'string' || !field.options.includes(value)) {
      return {
        ok: false,
        message: `runInput.${field.key}: must be one of ${field.options.join(', ')}`,
      };
    }
  }

  return { ok: true };
};
