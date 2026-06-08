import { isYahlDocument, parseYahlDocument } from './yahl-parse';

export const deriveTaskIdFromYahlPath = (taskYahlPath: string) => {
  const normalized = taskYahlPath.replace(/\\/g, '/').trim();
  const parts = normalized.split('/').filter(Boolean);

  if (parts.length >= 2 && parts[parts.length - 1]!.endsWith('.yahl')) {
    return parts[parts.length - 2]!;
  }

  return parts[0] ?? 'test';
};

export const deriveTaskNameFromYahl = (yahlText: string, taskYahlPath: string) => {
  try {
    if (isYahlDocument(yahlText)) {
      const doc = parseYahlDocument(yahlText);

      if (doc.name.trim()) {
        return doc.name.trim();
      }
    }
  } catch {
    /* fall through */
  }

  return deriveTaskIdFromYahlPath(taskYahlPath);
};
