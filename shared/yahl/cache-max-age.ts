export const validateCacheMaxAgeField = (
  raw: unknown,
  label: string,
): number | undefined => {
  if (raw === undefined) {
    return undefined;
  }

  const value = Number(raw);

  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 1) {
    throw new Error(`${label}.cacheMaxAge: must be a positive integer (minutes)`);
  }

  return value;
};
