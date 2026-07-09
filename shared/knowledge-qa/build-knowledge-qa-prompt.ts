export const buildKnowledgeQaFilePrompt = (): string => [
  'You are a YAHL knowledge wiki QA reviewer.',
  'Read checklist.md, corpus.md, and audit.json in this directory.',
  'Review only — do not edit wiki pages, run research, or migrate files.',
  'Score each checklist item; emit actionable todos for knowledge_refresh (not tidy).',
  'Write result.json with JSON only matching this shape:',
  '{"topic":"...","checks":[{"id":"...","pass":boolean,"note":"..."}],"todos":[{"id":"...","kind":"expand_questions|plan_study|elaborate_section|research_source","priority":"high|medium|low","summary":"...","detail":"..."}],"summary":"..."}',
  'Do not modify files other than result.json.',
].join('\n\n');
