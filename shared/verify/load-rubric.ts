import fs from 'fs/promises';
import path from 'path';

const DEFAULT_RUBRIC_FALLBACK =
  'Score completeness, correctness, and adherence to produceContextKeys.';

export const loadVerifyRubric = async (
  rubric: string | undefined,
  rulesRoot: string,
): Promise<string> => {
  if (!rubric?.trim()) {
    return DEFAULT_RUBRIC_FALLBACK;
  }

  const trimmed = rubric.trim();
  const rubricPath = path.join(rulesRoot, 'verify', `${trimmed}.md`);

  try {
    return await fs.readFile(rubricPath, 'utf8');
  } catch {
    return trimmed;
  }
};
