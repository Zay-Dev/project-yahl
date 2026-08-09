import fs from 'node:fs/promises';
import path from 'node:path';

import { validateKnowledgeObservation } from '/opt/nixery/knowledge-wiki/index.js';

import { resolveErrorWithKnowledge } from '../_shared/error-knowledge-resolver.mjs';
import { runKnowledgeSearchAgent } from '../_shared/knowledge-search-agent.mjs';
import { resolveObservationIncidentId } from '../_shared/observation-incident.mjs';
import { buildObservationInput } from '../_shared/observation-input.mjs';
import { logProgress, resolveDefId } from '../_shared/run-agent.mjs';
import { submitKnowledgeObservation } from '../_shared/submit-observation.mjs';

const LOOKUP_OUTPUT = 'lookup-result.json';
const MAX_LOOKUP_ROUNDS = 8;

const readJson = async (filePath) => {
  const raw = await fs.readFile(filePath, 'utf8');

  return JSON.parse(raw);
};

const buildLookupPrompt = (params) => [
  'Search the read-only wiki export at /data/knowledge_export for an existing, reusable solution to this concrete tool failure.',
  'Use shell ls, grep, and cat before deciding. Prefer HOWTO, TRICK, Q&A, applied observations, and evidence-backed successful paths over failure-only notes.',
  `Exclude the newly written observation path from results: ${params.excludedPath}`,
  'Do not modify the knowledge export.',
  `Failure context:\n${JSON.stringify(params.failure, null, 2)}`,
  `Write exactly one JSON object to /workspace/${LOOKUP_OUTPUT} with write_workspace_file.`,
  'Found shape: {"status":"found","solution":"actionable steps","citations":[{"path":"corpus path","excerpt":"supporting text"}]}.',
  'Not-found shape: {"status":"not_found","solution":null,"citations":[],"reason":"where and how you searched"}.',
  'Do not claim found without at least one real path and excerpt read from the corpus.',
].join('\n\n');

const writeGate = async (outputPath, gate) => {
  await fs.writeFile(outputPath, `${JSON.stringify(gate, null, 2)}\n`, 'utf8');
};

const main = async () => {
  const workspace = '/workspace';
  const defRoot = '/opt/nixery/def';
  const defId = resolveDefId(defRoot);
  const input = await readJson(path.join(workspace, 'input.json'));
  const outputName = typeof input.output === 'string' && input.output.trim()
    ? input.output.trim()
    : 'result.json';
  const outputPath = path.join(workspace, outputName);
  const lookupPath = path.join(workspace, LOOKUP_OUTPUT);

  const gate = await resolveErrorWithKnowledge({
    buildObservationInput,
    input,
    resolveObservationIncidentId,
    submitKnowledgeObservation,
    validateKnowledgeObservation,
    lookupKnowledge: async ({ incidentId, observation, observationGate }) => {
      logProgress(
        defId,
        `observed incident=${incidentId} topic=${observationGate.topic} path=${observationGate.path}`,
      );
      await fs.rm(lookupPath, { force: true });
      await runKnowledgeSearchAgent({
        defId,
        defRoot,
        input,
        maxToolRounds: MAX_LOOKUP_ROUNDS,
        outputName: LOOKUP_OUTPUT,
        systemContent: [
          'You are a bounded error-resolution knowledge agent.',
          'Search existing knowledge only; do not invent a solution.',
          'Use shell to inspect the corpus and write the requested JSON result with write_workspace_file.',
          'Stop immediately after writing the result.',
        ].join(' '),
        userPrompt: buildLookupPrompt({
          excludedPath: observationGate.path,
          failure: {
            tool: input.tool,
            topicHint: observation.topic_hint,
            cue: observation.cue,
            claim: observation.claim,
            example: observation.example,
            quote: observation.quote,
            evidence: observation.evidence,
          },
        }),
        workspace,
      });

      return readJson(lookupPath);
    },
  });

  if (gate.status === 'unavailable') {
    logProgress(defId, `lookup unavailable error=${gate.lookupError}`);
  }

  await writeGate(outputPath, gate);

  if (!gate.ok) {
    process.exit(1);
  }
};

main().catch((error) => {
  console.error('[nixery-resolve-error-with-knowledge]', error);
  process.exit(1);
});
