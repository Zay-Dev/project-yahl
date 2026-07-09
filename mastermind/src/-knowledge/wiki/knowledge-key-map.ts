import { slugifyPageSegment } from './wiki-paths.js';

const studySlugFromKey = (key: string): string =>
  slugifyPageSegment(key.slice('study_'.length));

export type TKnowledgeKeyMapping = {
  mode: 'append' | 'replace';
  narrative: boolean;
  page: string;
  raw: boolean;
  section?: string;
};

const wikiOnly = (
  page: string,
  mode: 'append' | 'replace' = 'replace',
): TKnowledgeKeyMapping => ({
  mode,
  narrative: true,
  page,
  raw: false,
});

const rawOnly = (key: string): TKnowledgeKeyMapping => ({
  mode: 'replace',
  narrative: false,
  page: `raw/${slugifyPageSegment(key)}`,
  raw: true,
});

const dualWrite = (
  page: string,
  section: string,
  mode: 'append' | 'replace' = 'replace',
): TKnowledgeKeyMapping => ({
  mode,
  narrative: true,
  page,
  raw: true,
  section,
});

const STATIC_KEY_MAP: Record<string, TKnowledgeKeyMapping> = {
  analysis: dualWrite('facts', 'Analysis'),
  background_summary: wikiOnly('overview', 'append'),
  communication_style: dualWrite('overview', 'Communication style'),
  constraints: dualWrite('overview', 'Constraints'),
  corpus_assessment: { mode: 'append', narrative: true, page: 'sources', raw: true },
  facts: dualWrite('facts', 'Key facts'),
  goals: dualWrite('overview', 'Goals & priorities'),
  identity: dualWrite('overview', 'Identity & background'),
  learning_contract: { mode: 'replace', narrative: true, page: 'sources', raw: true },
  meta: { mode: 'replace', narrative: true, page: 'overview', raw: true },
  onboarding_completed_at: dualWrite('overview', 'Status'),
  open_questions: dualWrite('overview', 'Open questions'),
  open_questions_qa: rawOnly('open_questions_qa'),
  preferences: dualWrite('overview', 'Preferences'),
  priorities: dualWrite('overview', 'Priorities'),
  sources: { mode: 'replace', narrative: true, page: 'sources', raw: true },
  study_plan: { mode: 'append', narrative: true, page: 'sources', raw: true },
  summary: { mode: 'replace', narrative: true, page: 'brief', raw: true },
  todo: { mode: 'replace', narrative: true, page: 'todo', raw: true },
  user_profile_summary: { mode: 'replace', narrative: true, page: 'brief', raw: true },
};

export const mapKnowledgeKeyToPage = (key: string): TKnowledgeKeyMapping => {
  const staticMapping = STATIC_KEY_MAP[key];

  if (staticMapping) {
    return staticMapping;
  }

  if (/^stage\d+_qa$/.test(key)) {
    return rawOnly(key);
  }

  if (key.startsWith('study_')) {
    const slug = studySlugFromKey(key);

    return {
      mode: 'replace',
      narrative: true,
      page: `studies/${slug}`,
      raw: true,
    };
  }

  if (key === 'analysis_md' || key === 'key_facts_md' || key.endsWith('_md') || key.endsWith('_summary')) {
    if (key === 'analysis_md' || key === 'summary_md') {
      return wikiOnly('overview', 'append');
    }

    if (key === 'key_facts_md') {
      return wikiOnly('facts', 'append');
    }

    return wikiOnly(slugifyPageSegment(key.replace(/_md$/, '')));
  }

  throw new Error(`upsert-knowledge-page: unknown key "${key}" — add mapping in knowledge-key-map.ts`);
};

export const resolveReadPathsForKey = (key: string, canonical: string): string[] => {
  const mapping = mapKnowledgeKeyToPage(key);
  const topicPrefix = `topics/${canonical}`;
  const paths: string[] = [];

  if (mapping.narrative) {
    paths.push(`${topicPrefix}/${mapping.page.split('#')[0]}`);
  }

  if (mapping.raw) {
    paths.push(`${topicPrefix}/raw/${slugifyPageSegment(key)}`);
  }

  return [...new Set(paths)];
};
