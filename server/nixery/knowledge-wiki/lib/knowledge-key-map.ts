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

/** Suggested key→page mappings only. Unknown keys fall back to wikiOnly(slugify(key)). */
const STATIC_KEY_MAP: Record<string, TKnowledgeKeyMapping> = {
  analysis: dualWrite('facts', 'Analysis'),
  background_summary: wikiOnly('overview', 'append'),
  communication_style: dualWrite('overview', 'Communication style'),
  constraints: dualWrite('overview', 'Constraints'),
  corpus_assessment: dualWrite('sources', 'Corpus assessment'),
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
  study_plan: dualWrite('sources', 'Study plan'),
  summary: { mode: 'replace', narrative: true, page: 'brief', raw: true },
  todo: { mode: 'replace', narrative: true, page: 'todo', raw: true },
  user_profile_summary: { mode: 'replace', narrative: true, page: 'brief', raw: true },
  wiki_structure: dualWrite('sources', 'Wiki structure'),
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
      return dualWrite('overview', key === 'analysis_md' ? 'Analysis' : 'Summary');
    }

    if (key === 'key_facts_md') {
      return dualWrite('facts', 'Key facts narrative');
    }

    return wikiOnly(slugifyPageSegment(key.replace(/_md$/, '')));
  }

  return wikiOnly(slugifyPageSegment(key));
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
