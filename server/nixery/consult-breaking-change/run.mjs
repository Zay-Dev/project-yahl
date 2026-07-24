import fs from 'node:fs/promises';
import path from 'node:path';

import { logProgress, resolveDefId } from '../_shared/run-agent.mjs';

const DISAGREE_PATTERNS = [
  { id: 'chunked-sleep', re: /\b(chunk(ed)?\s+sleep|sleep\s+\d+\s*[x×]\s*\d+|sleep\s+5\d|sub-?60|loop\s+of\s+sleeps)\b/i },
  { id: 'background-sleep', re: /\b(sleep\s+\d+\s*&|background(ed)?\s+sleep|nohup\s+sleep)\b/i },
  { id: 'alternate-wait', re: /\b(busy-?wait|poll(?:ing)?\s+loop|\/usr\/bin\/timeout|timeout\s+\d+\s+sleep|reinvent\w*\s+wait)\b/i },
  { id: 'edit-skill', re: /\b(edit|patch|rewrite|modify)\b.*\b(SKILL\.yahl|task-skills?|monitor-loop|task-mission)\b/i },
  { id: 'change-window', re: /\b(chang(e|ing)|extend|shorten|reduc(e|ing))\b.*\b(90\s*min|window|threshold|adaptive\s+sleep)\b/i },
];

const AGREE_PATTERNS = [
  { id: 'retry-transient', re: /\b(retry|re-?fetch|re-?probe)\b.*\b(transient|once|single|browser\s+extract|network)\b/i },
  { id: 'fix-typo', re: /\b(fix|correct)\b.*\b(typo|path|url)\b/i },
];

const readJson = async (filePath) => {
  const raw = await fs.readFile(filePath, 'utf8');

  return JSON.parse(raw);
};

const evaluate = (proposedChange, reason, context) => {
  const blob = [proposedChange, reason, context].filter(Boolean).join('\n');
  const matchedDisagree = DISAGREE_PATTERNS.filter((item) => item.re.test(blob)).map((item) => item.id);
  const matchedAgree = AGREE_PATTERNS.filter((item) => item.re.test(blob)).map((item) => item.id);

  if (matchedDisagree.length > 0) {
    return {
      agree: false,
      reasons: [
        `Breaking procedural change blocked (${matchedDisagree.join(', ')}).`,
        'Stage procedure (sleep protocol, window, thresholds, task skills) must stay as written unless an operator changes the task.',
      ],
      alternatives: [
        'Keep a single foreground sleep N matching the stage skill table.',
        'If run_bash timed out, surface the timeout error and stop — do not invent chunked or background waits.',
        'Ask the operator to update SKILL.yahl / task skills if the procedure must change.',
      ],
    };
  }

  if (matchedAgree.length > 0) {
    return {
      agree: true,
      reasons: [
        `Narrow operational fix allowed (${matchedAgree.join(', ')}).`,
      ],
      alternatives: [],
    };
  }

  return {
    agree: false,
    reasons: [
      'Default disagree: proposed change is not a recognized narrow reversible operational fix.',
      'Consult only for transient retries or typo/path corrections; procedural rewrites require operator task edits.',
    ],
    alternatives: [
      'Describe a single transient retry or typo fix, or leave the stage procedure unchanged.',
    ],
  };
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

  const proposedChange = typeof input.proposedChange === 'string' ? input.proposedChange.trim() : '';
  const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
  const context = typeof input.context === 'string' ? input.context.trim() : '';

  if (!proposedChange || !reason) {
    const gate = {
      agree: false,
      reasons: ['proposedChange and reason are required non-empty strings'],
      alternatives: ['Call again with proposedChange and reason filled in'],
    };

    await fs.writeFile(outputPath, `${JSON.stringify(gate, null, 2)}\n`, 'utf8');
    logProgress(defId, 'done agree=false missing-required');
    process.exit(1);
  }

  logProgress(defId, `start proposed=${proposedChange.slice(0, 80)}`);

  const gate = evaluate(proposedChange, reason, context);

  await fs.writeFile(outputPath, `${JSON.stringify(gate, null, 2)}\n`, 'utf8');
  logProgress(defId, `done agree=${gate.agree}`);

  if (!gate.agree) {
    process.exit(0);
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
