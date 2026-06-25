import fs from 'fs/promises';
import path from 'path';

import { paths } from '../config.js';
import { rebuildSourcesIndexFromStudies } from './index.js';
import {
  addAlias,
  listTopicFolderSummaries,
  loadRegistry,
  type TTopicFolderSummary,
} from './topic-registry.js';
import { normalizeTopicText, parseUrlSignals, urlSignalsOverlap } from './topic-slug.js';

const RESERVED_DIRS = new Set(['_index', '_archive']);
const KNOWLEDGE_EXTENSIONS = new Set(['.json']);

export type TTidyDuplicateGroup = {
  canonical: string;
  members: string[];
  orphanFiles: string[];
  overlappingKeys: string[];
};

export type TTidyKnowledgeReport = {
  applied: boolean;
  archived: string[];
  dryRun: boolean;
  groups: TTidyDuplicateGroup[];
  mergedKeys: string[];
};

const nowStamp = () => new Date().toISOString().slice(0, 10);

const listJsonBasenames = async (topicDir: string): Promise<string[]> => {
  try {
    const entries = await fs.readdir(topicDir, { withFileTypes: true });

    return entries
      .filter((entry) => entry.isFile() && KNOWLEDGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
      .map((entry) => path.basename(entry.name, path.extname(entry.name)))
      .sort();
  } catch {
    return [];
  }
};

const pickCanonicalSlug = (members: TTopicFolderSummary[]): string => {
  const sorted = [...members].sort((left, right) => {
    if (right.fileCount !== left.fileCount) {
      return right.fileCount - left.fileCount;
    }

    if (right.studyKeyCount !== left.studyKeyCount) {
      return right.studyKeyCount - left.studyKeyCount;
    }

    const leftUpdated = left.updatedAt ? Date.parse(left.updatedAt) : 0;
    const rightUpdated = right.updatedAt ? Date.parse(right.updatedAt) : 0;

    if (rightUpdated !== leftUpdated) {
      return rightUpdated - leftUpdated;
    }

    return left.slug.localeCompare(right.slug);
  });

  return sorted[0]?.slug ?? members[0]?.slug ?? 'general';
};

const buildDuplicateGroups = (summaries: TTopicFolderSummary[]): TTidyDuplicateGroup[] => {
  const assigned = new Set<string>();
  const groups: TTidyDuplicateGroup[] = [];

  for (let index = 0; index < summaries.length; index += 1) {
    const seed = summaries[index];

    if (!seed || assigned.has(seed.slug)) {
      continue;
    }

    const members = [seed];

    for (let otherIndex = index + 1; otherIndex < summaries.length; otherIndex += 1) {
      const other = summaries[otherIndex];

      if (!other || assigned.has(other.slug)) {
        continue;
      }

      const sameTopicText = seed.learningContractTopic
        && other.learningContractTopic
        && normalizeTopicText(seed.learningContractTopic) === normalizeTopicText(other.learningContractTopic);

      const urlOverlap = urlSignalsOverlap(
        parseUrlSignals(seed.seedUrls),
        parseUrlSignals(other.seedUrls),
      );

      if (sameTopicText || urlOverlap) {
        members.push(other);
      }
    }

    if (members.length < 2) {
      continue;
    }

    for (const member of members) {
      assigned.add(member.slug);
    }

    groups.push({
      canonical: pickCanonicalSlug(members),
      members: members.map((member) => member.slug).sort(),
      orphanFiles: [],
      overlappingKeys: [],
    });
  }

  return groups;
};

const enrichGroupMetadata = async (group: TTidyDuplicateGroup): Promise<TTidyDuplicateGroup> => {
  const keysByMember = new Map<string, string[]>();

  for (const member of group.members) {
    keysByMember.set(member, await listJsonBasenames(path.join(paths.knowledges, member)));
  }

  const canonicalKeys = new Set(keysByMember.get(group.canonical) ?? []);
  const overlappingKeys = new Set<string>();
  const orphanFiles: string[] = [];

  for (const member of group.members) {
    if (member === group.canonical) {
      continue;
    }

    for (const key of keysByMember.get(member) ?? []) {
      if (canonicalKeys.has(key)) {
        overlappingKeys.add(key);
      } else {
        orphanFiles.push(`${member}/${key}.json`);
      }
    }
  }

  return {
    ...group,
    orphanFiles: orphanFiles.sort(),
    overlappingKeys: [...overlappingKeys].sort(),
  };
};

const isNonEmptyJson = async (filePath: string): Promise<boolean> => {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw) as unknown;

    if (parsed === null || parsed === undefined) {
      return false;
    }

    if (typeof parsed === 'object' && !Array.isArray(parsed)) {
      return Object.keys(parsed as Record<string, unknown>).length > 0;
    }

    return true;
  } catch {
    return false;
  }
};

const mergeGroup = async (
  group: TTidyDuplicateGroup,
  report: TTidyKnowledgeReport,
): Promise<void> => {
  const canonicalDir = path.join(paths.knowledges, group.canonical);

  await fs.mkdir(canonicalDir, { recursive: true });

  for (const member of group.members) {
    if (member === group.canonical) {
      continue;
    }

    const memberDir = path.join(paths.knowledges, member);
    const entries = await fs.readdir(memberDir).catch(() => []);

    for (const entry of entries) {
      if (!entry.endsWith('.json')) {
        continue;
      }

      const sourcePath = path.join(memberDir, entry);
      const targetPath = path.join(canonicalDir, entry);
      const sourceNonEmpty = await isNonEmptyJson(sourcePath);
      const targetExists = await fs.stat(targetPath).then(() => true).catch(() => false);
      const targetNonEmpty = targetExists ? await isNonEmptyJson(targetPath) : false;

      if (!targetExists) {
        await fs.rename(sourcePath, targetPath);
        report.mergedKeys.push(`${member}/${entry} -> ${group.canonical}/${entry}`);
        continue;
      }

      if (!targetNonEmpty && sourceNonEmpty) {
        await fs.unlink(targetPath);
        await fs.rename(sourcePath, targetPath);
        report.mergedKeys.push(`${member}/${entry} -> ${group.canonical}/${entry}`);
        continue;
      }

      if (targetNonEmpty) {
        await fs.unlink(sourcePath);
      }
    }

    const remaining = await fs.readdir(memberDir).catch(() => []);

    if (!remaining.length) {
      const archiveRoot = path.join(paths.knowledges, '_archive');
      const archiveDir = path.join(archiveRoot, `${member}-${nowStamp()}`);

      await fs.mkdir(archiveRoot, { recursive: true });
      await fs.rename(memberDir, archiveDir);
      report.archived.push(member);
    }

    await addAlias(group.canonical, member);
  }

  const sources = await rebuildSourcesIndexFromStudies(group.canonical);

  if (sources.length) {
    const sourcesPath = path.join(canonicalDir, 'sources.json');

    await fs.writeFile(
      sourcesPath,
      `${JSON.stringify({ sources }, null, 2)}\n`,
      'utf8',
    );
  }
};

export const runTidyKnowledge = async (options?: { dryRun?: boolean }): Promise<TTidyKnowledgeReport> => {
  const dryRun = options?.dryRun !== false;
  const summaries = await listTopicFolderSummaries();
  const registry = await loadRegistry();
  const groups = await Promise.all(buildDuplicateGroups(summaries).map(enrichGroupMetadata));

  for (const entry of registry.topics) {
    const memberSet = new Set([entry.canonical, ...entry.aliases]);
    const members = summaries
      .map((summary) => summary.slug)
      .filter((slug) => memberSet.has(slug));

    if (members.length < 2) {
      continue;
    }

    const canonical = entry.canonical;
    const existing = groups.find((group) =>
      group.members.length === members.length
      && group.members.every((member) => members.includes(member)));

    if (existing) {
      existing.canonical = canonical;
      continue;
    }

    groups.push(await enrichGroupMetadata({
      canonical,
      members: [...memberSet].sort(),
      orphanFiles: [],
      overlappingKeys: [],
    }));
  }

  const report: TTidyKnowledgeReport = {
    applied: false,
    archived: [],
    dryRun,
    groups: groups.sort((left, right) => left.canonical.localeCompare(right.canonical)),
    mergedKeys: [],
  };

  if (dryRun) {
    return report;
  }

  for (const group of report.groups) {
    await mergeGroup(group, report);
  }

  report.applied = true;

  return report;
};

export const detectDuplicateGroups = async (): Promise<TTidyDuplicateGroup[]> => {
  const summaries = await listTopicFolderSummaries();

  return Promise.all(buildDuplicateGroups(summaries).map(enrichGroupMetadata));
};

export const isReservedKnowledgeDir = (name: string): boolean =>
  name.startsWith('.') || RESERVED_DIRS.has(name);
