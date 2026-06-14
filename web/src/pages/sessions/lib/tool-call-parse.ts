export type TSetContextArgs = {
  key: string;
  operation?: string;
  scope: string;
  value: unknown;
};

export type TToolArgumentParseResult = {
  parseError?: string;
  parsed: unknown;
  raw: string | null;
};

export const parseToolArgumentsDetailed = (raw: unknown): TToolArgumentParseResult => {
  if (raw === undefined || raw === null) {
    return { parsed: null, raw: null };
  }

  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return { parsed: raw, raw: JSON.stringify(raw) };
  }

  if (typeof raw !== 'string') {
    return { parsed: null, raw: String(raw) };
  }

  const trimmed = raw.trim();

  if (!trimmed) {
    return { parsed: null, raw: '' };
  }

  try {
    return { parsed: JSON.parse(trimmed) as unknown, raw: trimmed };
  } catch (error) {
    return {
      parseError: error instanceof Error ? error.message : String(error),
      parsed: null,
      raw: trimmed,
    };
  }
};

export const parseToolArguments = (raw: unknown): unknown =>
  parseToolArgumentsDetailed(raw).parsed;

export const isSetContextArgs = (value: unknown): value is TSetContextArgs => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.scope === 'string' &&
    typeof record.key === 'string' &&
    record.key.trim().length > 0 &&
    'value' in record
  );
};

export const summarizeValue = (value: unknown, maxLen = 200) => {
  if (value === null) {
    return 'null';
  }

  if (value === undefined) {
    return 'undefined';
  }

  if (typeof value === 'string') {
    if (value.length <= maxLen) {
      return value;
    }

    return `${value.slice(0, maxLen)}…`;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    return `Array(${value.length})`;
  }

  if (typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>);

    return `Object{${keys.slice(0, 5).join(', ')}${keys.length > 5 ? ', …' : ''}}`;
  }

  return String(value);
};

export const summarizeRawArguments = (raw: string | null, maxLen = 400) => {
  if (raw === null) {
    return null;
  }

  if (raw.length <= maxLen) {
    return raw;
  }

  return `${raw.slice(0, maxLen)}…`;
};
