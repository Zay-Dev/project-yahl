import fs from 'node:fs';

import {
  applyOverrideValues,
  resolveEnvOverridePath,
  statEnvOverridePath,
  stripUnlistedOverrideKeys,
} from '@project-yahl/shared/env/override-keys';

const overridePath = resolveEnvOverridePath();
const kind = statEnvOverridePath(overridePath);

if (kind === 'directory') {
  console.warn(
    `[env-override] ${overridePath} is a directory; skipping. `
    + 'Remove that path and use a file at .env.override.',
  );
} else if (kind === 'file') {
  const raw = fs.readFileSync(overridePath, 'utf8');
  const stripped = stripUnlistedOverrideKeys(raw);

  applyOverrideValues(stripped.values);
}
