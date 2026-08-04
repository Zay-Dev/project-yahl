import {
  collapseDuplicateWikiSections,
  parseWikiPageRef,
} from './section-merge.js';
import {
  getWikiPageByPath,
  upsertWikiPage,
} from './wiki-client.js';
import { resolveWikiPagePath } from './wiki-paths.js';

export type TDedupAction = {
  action: string;
  id?: string;
  issue?: string;
  pagePath?: string;
  sectionTitle?: string;
};

export type TDedupApplyResult = {
  id?: string;
  pagePath: string;
  status: 'applied' | 'skipped';
};

export const resolveCanonicalFromPagePath = (
  pagePath: string,
): { canonical: string; page: string } | null => {
  const normalized = pagePath.replace(/^\/+/, '').replace(/^en\//, '');
  const match = normalized.match(/^topics\/([^/]+)\/(.+)$/);

  if (!match) {
    return null;
  }

  return {
    canonical: match[1],
    page: match[2],
  };
};

export const applyDedupAction = async (item: TDedupAction): Promise<TDedupApplyResult> => {
  const pagePath = item.pagePath?.trim() ?? '';

  if (!pagePath) {
    return {
      id: item.id,
      pagePath: '',
      status: 'skipped',
    };
  }

  const resolved = resolveCanonicalFromPagePath(pagePath);

  if (!resolved) {
    return {
      id: item.id,
      pagePath,
      status: 'skipped',
    };
  }

  const wikiPath = resolveWikiPagePath(resolved.canonical, resolved.page);
  const existing = await getWikiPageByPath(wikiPath);
  const existingContent = existing?.content ?? '';

  if (!existingContent.trim()) {
    return {
      id: item.id,
      pagePath,
      status: 'skipped',
    };
  }

  const action = item.action.trim().toLowerCase();

  if (
    action === 'collapse_section'
    || action === 'collapse_duplicate_section'
    || action === 'duplicate_section'
    || action === 'stacked_key_facts'
  ) {
    const sectionTitle = item.sectionTitle?.trim()
      || parseWikiPageRef(resolved.page).section;
    const repaired = collapseDuplicateWikiSections(existingContent, sectionTitle);

    if (repaired.trim() === existingContent.trim()) {
      return {
        id: item.id,
        pagePath,
        status: 'skipped',
      };
    }

    await upsertWikiPage({
      content: repaired,
      mode: 'replace',
      pagePath: wikiPath,
    });

    return {
      id: item.id,
      pagePath,
      status: 'applied',
    };
  }

  if (action === 'collapse_page' || action === 'collapse_all_sections') {
    const repaired = collapseDuplicateWikiSections(existingContent);

    if (repaired.trim() === existingContent.trim()) {
      return {
        id: item.id,
        pagePath,
        status: 'skipped',
      };
    }

    await upsertWikiPage({
      content: repaired,
      mode: 'replace',
      pagePath: wikiPath,
    });

    return {
      id: item.id,
      pagePath,
      status: 'applied',
    };
  }

  return {
    id: item.id,
    pagePath,
    status: 'skipped',
  };
};

export const applyDedupActions = async (
  items: TDedupAction[],
): Promise<{ applied: TDedupApplyResult[]; skipped: TDedupApplyResult[] }> => {
  const applied: TDedupApplyResult[] = [];
  const skipped: TDedupApplyResult[] = [];

  for (const item of items) {
    const result = await applyDedupAction(item);

    if (result.status === 'applied') {
      applied.push(result);
    } else {
      skipped.push(result);
    }
  }

  return { applied, skipped };
};
