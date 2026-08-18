import fs from 'node:fs/promises';
import path from 'node:path';

import { validateKnowledgeObservation } from '/opt/nixery/plugin/lib/dist/index.js';

import { logProgress, resolveDefId } from '../lib/run-agent.mjs';
import { buildObservationInput } from '../lib/observation-input.mjs';
import { readNixeryRetryMeta } from '../lib/nixery-retry-feedback.mjs';
import { grepKnowledgeCorpus } from '../lib/error-knowledge-corpus-grep.mjs';
import { runKnowledgeSearchAgent } from '../lib/knowledge-search-agent.mjs';
import { submitKnowledgeObservation } from '../lib/submit-observation.mjs';
import { resolveErrorWithKnowledge } from '../lib/error-knowledge-resolver.mjs';
import { resolveObservationIncidentId } from '../lib/observation-incident.mjs';
import { LOOKUP_OUTPUT, buildLookupPrompt } from '../lib/error-knowledge-lookup-prompt.mjs';

const MAX_LOOKUP_ROUNDS = 8;

const readJson = async (filePath) => {
  const raw = await fs.readFile(filePath, 'utf8');

  return JSON.parse(raw);
};

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
  const { isFinalAttempt } = readNixeryRetryMeta(input);

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
      const candidates = await grepKnowledgeCorpus({
        claim: observation.claim,
        cue: observation.cue,
        excludedPath: observationGate.path,
        root: process.env.KNOWLEDGE_EXPORT_ROOT?.trim() || '/data/knowledge_export',
        tool: input.tool,
      });

      logProgress(defId, `corpus grep hits=${candidates.length}`);
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
          'Prefer the seeded corpus grep candidates. Cat those files before grepping the whole tree.',
          'Use shell to inspect the corpus and write the requested JSON result with write_workspace_file.',
          'Stop immediately after writing the result.',
        ].join(' '),
        userPrompt: buildLookupPrompt({
          candidates,
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

    if (!isFinalAttempt) {
      logProgress(
        defId,
        'lookup incomplete on non-final attempt; exiting for orchestrator soft-fail restart',
      );
      process.exit(1);
    }
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
