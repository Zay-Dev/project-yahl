import fs from 'node:fs/promises';
import path from 'node:path';

import { writeSharedOneCliOverride } from '@/orchestrator/-docker/compose-onecli';
import { workspaceRoot } from '@/orchestrator/-utils/workspace-paths';

import { loadNixeryDef } from './load-def';
import { resolveNixeryEnv } from './resolve-def-env';
import { resolveMounts } from './resolve-mounts';
import { prepareNixeryImage, runNixeryContainer } from './run-container';

export const resolveSessionNixeryDir = (sessionId: string, defId: string) =>
  path.join(workspaceRoot(), 'sessions', sessionId, 'nixery', defId);

export const runNixeryDef = async (params: {
  defId: string;
  input: Record<string, string>;
  sessionId: string;
}) => {
  await writeSharedOneCliOverride();

  const def = await loadNixeryDef(params.defId);
  const sessionDir = resolveSessionNixeryDir(params.sessionId, params.defId);

  await fs.mkdir(sessionDir, { recursive: true });
  await fs.writeFile(
    path.join(sessionDir, 'input.json'),
    JSON.stringify(params.input, null, 2),
    'utf8',
  );

  if (!def.run?.entry?.length) {
    throw new Error(`[nixery] def ${params.defId} requires run.entry`);
  }

  const { env, volumeMounts: oneCliMounts } = await resolveNixeryEnv(def.env);
  const defMounts = resolveMounts({
    def,
    defId: params.defId,
    sessionId: params.sessionId,
  });
  const { cleanup, image } = await prepareNixeryImage(def.packages);

  console.log(
    `[nixery] run start def=${params.defId} sessionId=${params.sessionId} image=${image}`,
  );

  try {
    await runNixeryContainer({
      entry: def.run.entry,
      env,
      image,
      volumeMounts: [...defMounts, ...oneCliMounts],
    });
  } finally {
    await cleanup();
  }

  console.log(
    `[nixery] run done def=${params.defId} sessionId=${params.sessionId}`,
  );
};

export const runNixeryStage = async (params: {
  defId: string;
  input: Record<string, string>;
  sessionId: string;
}) => {
  await runNixeryDef(params);
};
