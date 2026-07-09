import fs from 'fs/promises';
import path from 'path';

const DEFAULT_CHECKLIST = [
  '# knowledge-qa-checklist',
  '',
  'Review wiki corpus against canonical layout and prose quality.',
  'Emit todos only for gaps knowledge_refresh should handle.',
].join('\n');

export const loadKnowledgeQaChecklist = async (checklistRoot: string): Promise<string> => {
  const skillPath = path.join(checklistRoot, 'SKILL.md');

  try {
    return await fs.readFile(skillPath, 'utf8');
  } catch {
    return DEFAULT_CHECKLIST;
  }
};
