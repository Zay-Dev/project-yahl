import path from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';

const execFileAsync = promisify(execFile);

export const MAX_CANDIDATE_FILES = 20;
export const MAX_CANDIDATE_POOL = 80;
export const MAX_EXCERPT_CHARS = 400;
export const MAX_PHRASE_CHARS = 120;

const STOPWORDS = new Set([
  'and',
  'are',
  'been',
  'but',
  'for',
  'from',
  'have',
  'into',
  'need',
  'not',
  'passed',
  'shape',
  'than',
  'that',
  'the',
  'their',
  'them',
  'then',
  'they',
  'this',
  'was',
  'were',
  'with',
  'you',
  'your',
]);

const normalizeRel = (value) =>
  String(value ?? '')
    .replaceAll('\\', '/')
    .replace(/^\.\//, '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');

export const isExcludedCorpusPath = (relPath, excludedPath) => {
  const rel = normalizeRel(relPath);
  const excluded = normalizeRel(excludedPath);

  if (!rel || !excluded) {
    return false;
  }

  if (rel === excluded || rel === `${excluded}.md`) {
    return true;
  }

  return rel.startsWith(`${excluded}/`)
    || rel.startsWith(`${excluded}.md`)
    || rel.endsWith(`/${excluded}`)
    || rel.endsWith(`/${excluded}.md`);
};

export const rankCorpusCandidate = (hit, toolHint = '') => {
  const rel = String(hit?.path ?? '').toLowerCase();
  const excerpt = String(hit?.excerpt ?? '').toLowerCase();
  const tool = String(toolHint ?? '').toLowerCase();
  const toolSegment = tool.includes('/')
    ? tool.split('/').filter(Boolean).at(-1)
    : tool;
  let score = 0;

  if (toolSegment && (rel.includes(toolSegment) || excerpt.includes(toolSegment))) {
    score += 6;
  }

  if (rel.endsWith('facts.md') || rel.includes('/howto')) {
    score += 3;
  }

  if (excerpt.includes('howto') || excerpt.includes('trick') || excerpt.includes('worked example')) {
    score += 4;
  }

  if (rel.includes('/error-') || /\/error-[a-f0-9]/.test(rel)) {
    score -= 3;
  }

  return score;
};

export const tokenizeDistinctive = (value) => {
  const matches = String(value ?? '').toLowerCase().match(/[a-z0-9][a-z0-9_./-]{2,}/g) ?? [];

  return [...new Set(matches.filter((token) => token.length >= 4 && !STOPWORDS.has(token)))];
};

export const buildCorpusGrepQueries = ({ claim, cue, tool } = {}) => {
  const seen = new Set();
  const queries = [];

  const push = (value) => {
    const trimmed = typeof value === 'string' ? value.trim() : '';

    if (!trimmed) {
      return;
    }

    const key = trimmed.toLowerCase();

    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    queries.push(trimmed);
  };

  const pushPhrase = (value) => {
    const trimmed = typeof value === 'string' ? value.trim() : '';

    if (!trimmed || trimmed.length > MAX_PHRASE_CHARS) {
      return;
    }

    if (tokenizeDistinctive(trimmed).length === 0) {
      return;
    }

    push(trimmed);
  };

  push(tool);

  if (typeof tool === 'string' && tool.includes('/')) {
    push(tool.split('/').filter(Boolean).at(-1));
  }

  if (typeof cue === 'string' && cue.trim().length > MAX_PHRASE_CHARS) {
    for (const token of tokenizeDistinctive(cue)) {
      push(token);
    }
  } else {
    pushPhrase(cue);
  }

  pushPhrase(claim);

  for (const token of tokenizeDistinctive(claim)) {
    push(token);
  }

  return queries;
};

const parseGrepLine = (line, root) => {
  const match = line.match(/^(.*?):(\d+):(.*)$/);

  if (!match) {
    return null;
  }

  const filePath = match[1];
  const excerpt = match[3].trim();

  if (!filePath || !excerpt) {
    return null;
  }

  const absolute = path.resolve(filePath);
  const relative = normalizeRel(path.relative(root, absolute));

  if (!relative || relative.startsWith('..')) {
    return null;
  }

  return {
    excerpt,
    path: relative,
  };
};

const defaultExecGrep = async (query, root) => {
  try {
    const { stdout } = await execFileAsync(
      'grep',
      ['-R', '-I', '-n', '-H', '-i', '-F', '--', query, root],
      {
        maxBuffer: 2 * 1024 * 1024,
        timeout: 30_000,
      },
    );

    return stdout?.toString?.() ?? '';
  } catch (error) {
    if (error.code === 1) {
      return error.stdout?.toString?.() ?? '';
    }

    throw error;
  }
};

export const grepKnowledgeCorpus = async (params = {}) => {
  const root = params.root
    ?? (process.env.KNOWLEDGE_EXPORT_ROOT?.trim() || '/data/knowledge_export');
  const excludedPath = params.excludedPath ?? '';
  const maxFiles = params.maxFiles ?? MAX_CANDIDATE_FILES;
  const maxPool = params.maxPool ?? MAX_CANDIDATE_POOL;
  const maxExcerptChars = params.maxExcerptChars ?? MAX_EXCERPT_CHARS;
  const queries = params.queries ?? buildCorpusGrepQueries(params);
  const toolHint = typeof params.tool === 'string' && params.tool.trim()
    ? params.tool.trim()
    : queries[0] ?? '';
  const execGrep = params.execGrep ?? defaultExecGrep;
  const byPath = new Map();

  for (const query of queries) {
    if (byPath.size >= maxPool) {
      break;
    }

    const stdout = await execGrep(query, root);

    for (const line of stdout.split('\n')) {
      if (byPath.size >= maxPool) {
        break;
      }

      const parsed = parseGrepLine(line.trim(), root);

      if (!parsed || isExcludedCorpusPath(parsed.path, excludedPath)) {
        continue;
      }

      if (byPath.has(parsed.path)) {
        continue;
      }

      byPath.set(parsed.path, {
        excerpt: parsed.excerpt.slice(0, maxExcerptChars),
        path: parsed.path,
      });
    }
  }

  return [...byPath.values()]
    .sort((left, right) => {
      const delta = rankCorpusCandidate(right, toolHint) - rankCorpusCandidate(left, toolHint);

      if (delta !== 0) {
        return delta;
      }

      return left.path.localeCompare(right.path);
    })
    .slice(0, maxFiles);
};
