export const EMPTY_VALUE = "—";
export const JSON_SPACING = 2;

export const formatNumber = (value: number) => Intl.NumberFormat().format(value);

export const formatCost = (value: number) => `$${value.toFixed(5)}`;

export const formatDuration = (value: number) => {
  const totalMs = Math.max(0, Math.round(value));
  const hours = Math.floor(totalMs / 3_600_000);
  const minutes = Math.floor((totalMs % 3_600_000) / 60_000);
  const seconds = Math.floor((totalMs % 60_000) / 1_000);
  const milliseconds = totalMs % 1_000;
  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  const mmm = String(milliseconds).padStart(3, "0");

  return `${hh}:${mm}:${ss}.${mmm}`;
};

export const truncateText = (value: string, max: number) => {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}...`;
};

export const stringifyValue = (value: unknown) => {
  if (value === null || value === undefined) return EMPTY_VALUE;
  if (typeof value === "string") return value || EMPTY_VALUE;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value, null, JSON_SPACING);
};

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
