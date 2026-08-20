import fs from 'node:fs/promises';
import path from 'node:path';

import { logProgress, resolveDefId } from '../lib/run-agent.mjs';

const SCRIPT_ID_PATTERN = /^[a-zA-Z][a-zA-Z0-9_-]*$/;

const CANDIDATES = [
  {
    scriptId: 'extract-routes-normalize',
    kind: 'normalize',
    contract: 'stdin extract JSON → stdout coerced TTrafficFetch.routes-shaped object',
    when: ({ ids, pain }) => ids.has('extract-routes') && !ids.has('extract-routes-normalize')
      || /\b(extract|schema|coerce|normalize|No object generated)\b/i.test(pain),
  },
  {
    scriptId: 'format-fetch-section',
    kind: 'js',
    contract: 'stdin {fetch, analysis, origin, destination, timezone} → stdout day-page markdown section',
    when: ({ ids, pain, stageHint }) => !ids.has('format-fetch-section')
      && (/\b(day-?page|format.?section|fetch.?section)\b/i.test(pain)
        || /\bmonitor\b/i.test(stageHint)),
  },
  {
    scriptId: 'adaptive-sleep-sec',
    kind: 'js',
    contract: 'stdin {fetch, prev_primary_eta} → stdout { sleep_sec: number }',
    when: ({ ids, pain }) => !ids.has('adaptive-sleep-sec')
      && /\b(sleep|eta.?%|adaptive)\b/i.test(pain),
  },
  {
    scriptId: 'format-report-run',
    kind: 'js',
    contract: 'stdin report fields → stdout markdown append for raw/report page',
    when: ({ ids, pain, stageHint }) => !ids.has('format-report-run')
      && (/\breport\b/i.test(pain) || /\breport\b/i.test(stageHint)),
  },
  {
    scriptId: 'bind-directions-url',
    kind: 'js',
    contract: 'stdin {template, origin, destination} → stdout { url: string } via encodeURIComponent',
    when: ({ ids, pain }) => !ids.has('bind-directions-url')
      && /\b(url|encodeURIComponent|directions.?template)\b/i.test(pain),
  },
  {
    scriptId: 'extract-routes',
    kind: 'recipe',
    contract: 'ordered browser recipe for multi-route ETA extract; placeholders {{bind_origin}} {{bind_destination}}',
    when: ({ ids, pain }) => !ids.has('extract-routes')
      && /\b(browser|recipe|howto|fetch.?routes|stagehand)\b/i.test(pain),
  },
];

const parseExisting = (raw) => {
  if (typeof raw !== 'string' || !raw.trim()) {
    return [];
  }

  const trimmed = raw.trim();

  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);

      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item).trim()).filter(Boolean);
      }
    } catch {
      // fall through to line/comma split
    }
  }

  return trimmed
    .split(/[\n,]+/)
    .map((item) => item.trim().replace(/\.(js|recipe\.json|meta\.json)$/i, ''))
    .filter(Boolean);
};

const readJson = async (filePath) => {
  const raw = await fs.readFile(filePath, 'utf8');

  return JSON.parse(raw);
};

const evaluate = (existingScripts, pain, stageHint) => {
  const ids = new Set(
    existingScripts
      .map((id) => id.replace(/\.(js|recipe\.json|meta\.json)$/i, ''))
      .filter((id) => SCRIPT_ID_PATTERN.test(id)),
  );
  const ctx = { ids, pain, stageHint };

  for (const candidate of CANDIDATES) {
    if (!candidate.when(ctx)) {
      continue;
    }

    if (ids.has(candidate.scriptId)) {
      continue;
    }

    return {
      action: 'advise',
      scriptId: candidate.scriptId,
      kind: candidate.kind,
      contract: candidate.contract,
      reasons: [
        `Next single script: ${candidate.scriptId} (${candidate.kind}).`,
        'Implement only this piece; do not grow a multi-op monolith this turn.',
      ],
      existingScripts: [...ids],
    };
  }

  return {
    action: 'skip',
    scriptId: null,
    kind: null,
    contract: null,
    reasons: [
      'No new small script advised.',
      'Reuse existing ~/data/scripts artifacts; rewrite only on miss of a specific op.',
    ],
    existingScripts: [...ids],
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

  const existingScripts = parseExisting(
    typeof input.existingScripts === 'string' ? input.existingScripts : '',
  );
  const pain = typeof input.pain === 'string' ? input.pain.trim() : '';
  const stageHint = typeof input.stageHint === 'string' ? input.stageHint.trim() : '';

  logProgress(defId, `start existing=${existingScripts.length} pain=${pain.slice(0, 60)}`);

  const gate = evaluate(existingScripts, pain, stageHint);

  await fs.writeFile(outputPath, `${JSON.stringify(gate, null, 2)}\n`, 'utf8');
  logProgress(defId, `done action=${gate.action} scriptId=${gate.scriptId ?? 'none'}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
