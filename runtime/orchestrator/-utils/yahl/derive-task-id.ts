import { isYahlDocument, parseYahlDocumentName } from './parse';

export const deriveTaskIdFromYahlPath = (taskYahlPath: string) => {
  const normalized = taskYahlPath.replace(/\\/g, '/').trim();
  const parts = normalized.split('/').filter(Boolean);

  const basename = parts[parts.length - 1]!;

  if (
    parts.length >= 2
    && (basename.endsWith('.yaml') || basename.endsWith('.yml'))
  ) {
    return parts[parts.length - 2]!;
  }

  return parts[0] ?? 'test';
};

export const deriveTaskNameFromYahl = (yahlText: string, taskYahlPath: string) => {
  try {
    if (isYahlDocument(yahlText)) {
      const name = parseYahlDocumentName(yahlText);

      if (name) {
        return name;
      }
    }
  } catch {
    /* fall through */
  }

  return deriveTaskIdFromYahlPath(taskYahlPath);
};
