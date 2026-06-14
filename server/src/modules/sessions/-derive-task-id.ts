export const deriveTaskIdFromYahlPath = (taskYahlPath: string) => {
  const normalized = taskYahlPath.replace(/\\/g, '/').trim();
  const parts = normalized.split('/').filter(Boolean);

  if (parts.length >= 2 && parts[parts.length - 1]!.endsWith('.yahl')) {
    return parts[parts.length - 2]!;
  }

  return parts[0] ?? 'test';
};
