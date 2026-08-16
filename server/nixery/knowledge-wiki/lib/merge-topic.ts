import { addAlias } from './topic-registry.js';
import { assertSameDomainMerge } from './topic-domain.js';
import {
  deleteWikiPage,
  getWikiPageByPath,
  listWikiPagesUnderPrefix,
  upsertWikiPage,
  wikiConfigured,
} from './wiki-client.js';
import { resolveTopicWikiPrefix } from './wiki-paths.js';

export type TMergeTopicResult = {
  aliased: boolean;
  ok: true;
  pagesMerged: number;
  pagesRetired: number;
  sourceTopic: string;
  targetTopic: string;
};

export type TRetireTopicWikiTreeResult = {
  ok: true;
  pagesRetired: number;
  topic: string;
};

const stripFrontmatter = (content: string): string => {
  const trimmed = content.trim();

  if (!trimmed.startsWith('---')) {
    return trimmed;
  }

  const end = trimmed.indexOf('\n---', 3);

  if (end < 0) {
    return trimmed;
  }

  return trimmed.slice(end + 4).trim();
};

const mergeNote = (sourceTopic: string, body: string): string => {
  const stamp = new Date().toISOString().slice(0, 10);

  return [
    `## Merged from \`${sourceTopic}\` (${stamp})`,
    '',
    body.trim(),
  ].join('\n');
};

export const pickCanonicalTopic = (topics: string[]): string => {
  const cleaned = [...new Set(topics.map((topic) => topic.trim()).filter(Boolean))];

  if (cleaned.length === 0) {
    return '';
  }

  const score = (topic: string): [number, number, string] => {
    const slug = topic.toLowerCase();
    const stem = slug.endsWith('s') && !slug.endsWith('ss') && slug.length > 3
      ? slug.slice(0, -1)
      : slug;

    return [stem.length, slug.length, slug];
  };

  return [...cleaned].sort((left, right) => {
    const a = score(left);
    const b = score(right);

    if (a[0] !== b[0]) {
      return a[0] - b[0];
    }

    if (a[1] !== b[1]) {
      return a[1] - b[1];
    }

    return a[2].localeCompare(b[2]);
  })[0];
};

export const retireTopicWikiTree = async (topic: string): Promise<TRetireTopicWikiTreeResult> => {
  const slug = topic.trim();

  if (!slug) {
    throw new Error('retireTopicWikiTree requires topic');
  }

  if (!wikiConfigured()) {
    throw new Error('Wiki GraphQL is not configured');
  }

  const pages = await listWikiPagesUnderPrefix(resolveTopicWikiPrefix(slug));
  let pagesRetired = 0;

  for (const page of pages) {
    if (!page.path) {
      continue;
    }

    const deleted = await deleteWikiPage(page.path);

    if (deleted) {
      pagesRetired += 1;
    }
  }

  return {
    ok: true,
    pagesRetired,
    topic: slug,
  };
};

export const mergeTopic = async (options: {
  dryRun?: boolean;
  sourceTopic: string;
  targetTopic: string;
}): Promise<TMergeTopicResult> => {
  const sourceTopic = options.sourceTopic.trim();
  const targetTopic = options.targetTopic.trim();

  if (!sourceTopic || !targetTopic) {
    throw new Error('mergeTopic requires sourceTopic and targetTopic');
  }

  if (sourceTopic === targetTopic) {
    throw new Error('mergeTopic sourceTopic and targetTopic must differ');
  }

  assertSameDomainMerge(sourceTopic, targetTopic);

  if (!wikiConfigured()) {
    throw new Error('Wiki GraphQL is not configured');
  }

  let pagesMerged = 0;
  const honeablePageNames = ['facts', 'overview', 'howto', 'brief', 'todo', 'sources'] as const;
  const honeablePages = new Set<string>(honeablePageNames);
  const sourcePrefix = resolveTopicWikiPrefix(sourceTopic);
  const targetPrefix = resolveTopicWikiPrefix(targetTopic);
  const sourcePages = await listWikiPagesUnderPrefix(sourcePrefix);

  if (!options.dryRun) {
    for (const page of honeablePageNames) {
      const sourcePath = `${sourcePrefix}/${page}`;
      const existing = await getWikiPageByPath(sourcePath);
      const body = existing?.content ? stripFrontmatter(existing.content) : '';

      if (!body || body === '# Raw' || /_\(no facts yet\)_/i.test(body) || body.length < 40) {
        continue;
      }

      const targetPath = `${targetPrefix}/${page}`;
      const target = await getWikiPageByPath(targetPath);
      const targetBody = target?.content ? stripFrontmatter(target.content) : '';

      if (targetBody.includes(body.slice(0, Math.min(120, body.length)))) {
        continue;
      }

      await upsertWikiPage({
        content: mergeNote(sourceTopic, body),
        mode: 'append',
        pagePath: targetPath,
      });
      pagesMerged += 1;
    }

    for (const page of sourcePages) {
      if (!page.path?.startsWith(`${sourcePrefix}/`)) {
        continue;
      }

      const relative = page.path.slice(sourcePrefix.length + 1);

      if (!relative || honeablePages.has(relative)) {
        continue;
      }

      const existing = page.content
        ? { content: page.content }
        : await getWikiPageByPath(page.path);
      const content = existing?.content?.trim() ?? '';

      if (!content) {
        continue;
      }

      const targetPath = `${targetPrefix}/${relative}`;
      const target = await getWikiPageByPath(targetPath);

      if (target?.content?.trim()) {
        continue;
      }

      await upsertWikiPage({
        content,
        mode: 'replace',
        pagePath: targetPath,
      });
      pagesMerged += 1;
    }

    await addAlias(targetTopic, sourceTopic);
  }

  let pagesRetired = 0;

  if (!options.dryRun) {
    const retired = await retireTopicWikiTree(sourceTopic);
    pagesRetired = retired.pagesRetired;
  }

  return {
    aliased: !options.dryRun,
    ok: true,
    pagesMerged,
    pagesRetired: options.dryRun ? sourcePages.length : pagesRetired,
    sourceTopic,
    targetTopic,
  };
};
