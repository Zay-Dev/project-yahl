export type TSetContextArgs = {
  key: string;
  operation?: string;
  scope: string;
  value: unknown;
};

export const parseToolArguments = (raw: unknown): unknown => {
  if (raw === undefined || raw === null) {
    return null;
  }

  if (typeof raw === "object" && !Array.isArray(raw)) {
    return raw;
  }

  if (typeof raw !== "string" || !raw.trim()) {
    return null;
  }

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
};

export const isSetContextArgs = (value: unknown): value is TSetContextArgs => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.scope === "string" &&
    typeof record.key === "string" &&
    record.key.trim().length > 0 &&
    "value" in record
  );
};

export const summarizeValue = (value: unknown, maxLen = 200) => {
  if (value === null) {
    return "null";
  }

  if (value === undefined) {
    return "undefined";
  }

  if (typeof value === "string") {
    if (value.length <= maxLen) {
      return value;
    }

    return `${value.slice(0, maxLen)}…`;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return `Array(${value.length})`;
  }

  if (typeof value === "object") {
    const keys = Object.keys(value as Record<string, unknown>);

    return `Object{${keys.slice(0, 5).join(", ")}${keys.length > 5 ? ", …" : ""}}`;
  }

  return String(value);
};
