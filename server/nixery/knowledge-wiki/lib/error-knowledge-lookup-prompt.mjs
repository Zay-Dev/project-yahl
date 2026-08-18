export const LOOKUP_OUTPUT = 'lookup-result.json';

const formatCandidates = (candidates) => {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return [
      'Corpus grep found no candidates.',
      'You may grep -R the whole /data/knowledge_export yourself (no pipes, no find).',
      'If nothing reusable is found, write not_found.',
    ].join(' ');
  }

  return [
    'Corpus grep already found these candidate files.',
    'Cat the most relevant HOWTO, TRICK, applied observations, and evidence-backed successful paths first.',
    'Skip failure-only notes unless nothing else matches.',
    'Do not start by listing the topic_hint directory; that is only the new observation filing location.',
    `Candidates:\n${JSON.stringify(candidates, null, 2)}`,
  ].join('\n\n');
};

export const buildLookupPrompt = ({
  candidates = [],
  excludedPath,
  failure,
} = {}) => [
  'Search the read-only wiki export at /data/knowledge_export for an existing, reusable solution to this concrete tool failure.',
  formatCandidates(candidates),
  `Exclude the newly written observation path from results: ${excludedPath}`,
  'topic_hint is filing metadata only — never use it as the search root.',
  'Do not modify the knowledge export.',
  `Failure context:\n${JSON.stringify(failure ?? {}, null, 2)}`,
  `After reading 1-2 real matching files, write exactly one JSON object to /workspace/${LOOKUP_OUTPUT} with write_workspace_file.`,
  'Found shape: {"status":"found","solution":"actionable steps","citations":[{"path":"corpus path","excerpt":"supporting text"}]}.',
  'Not-found shape: {"status":"not_found","solution":null,"citations":[],"reason":"where and how you searched"}.',
  'Do not claim found without at least one real path and excerpt read from the corpus.',
].join('\n\n');
