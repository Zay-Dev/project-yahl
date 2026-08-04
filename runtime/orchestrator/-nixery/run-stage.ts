import fs from 'node:fs/promises';
import path from 'node:path';

import { writeSharedOneCliOverride } from '@/orchestrator/-docker/compose-onecli';
import { resolveDockerHostRepoRoot } from '@/orchestrator/-docker/paths';
import { workspaceRoot } from '@/orchestrator/-utils/workspace-paths';

import { loadNixeryDef, resolveNixeryRoot } from './load-def';
import { resolveNixeryEnv } from './resolve-def-env';
import { resolveMounts } from './resolve-mounts';
import {
  confirmNixeryContainerStopped,
  prepareNixeryImage,
  resolveNixeryContainerName,
  runNixeryContainerDetached,
  startNixeryLogStream,
} from './run-container';
import { waitForNixeryOutput } from './validate-output';
import { assertNamespaceWriteAllowed } from '@project-yahl/shared/nixery/knowledge-write-gate';
import { fetchSession } from '@/orchestrator/-ask-user/session-api';

export const resolveSessionNixeryDir = (sessionId: string, defId: string) =>
  path.join(workspaceRoot(), 'sessions', sessionId, 'nixery', defId);

export type TNixeryRunResult = {
  containerName: string;
};

let activeNixeryContainer: string | null = null;
let sigtermHookRegistered = false;

const registerSigtermHook = () => {
  if (sigtermHookRegistered) {
    return;
  }

  sigtermHookRegistered = true;

  const shutdown = () => {
    const containerName = activeNixeryContainer;

    if (!containerName) {
      return;
    }

    void confirmNixeryContainerStopped(containerName).catch((error) => {
      console.error(`[nixery] sigterm teardown failed container=${containerName}`, error);
    });
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
};

const resolveDiagnosticsLogPath = (sessionId: string, defId: string) =>
  path.join(workspaceRoot(), 'sessions', sessionId, 'diagnostics', `nixery-${defId}.log`);

export const teardownNixeryContainer = async (
  containerName: string,
  sessionId: string,
  defId: string,
) => {
  const logPath = resolveDiagnosticsLogPath(sessionId, defId);

  await fs.mkdir(path.dirname(logPath), { recursive: true });

  const appendLog = async (message: string) => {
    console.log(message);
    await fs.appendFile(logPath, `${message}\n`, 'utf8');
  };

  await confirmNixeryContainerStopped(containerName, (message) => {
    void appendLog(message);
  });

  if (activeNixeryContainer === containerName) {
    activeNixeryContainer = null;
  }
};

export const runNixeryDef = async (params: {
  defId: string;
  input: Record<string, unknown>;
  sessionId: string;
  skipTeardown?: boolean;
  taskId?: string;
}): Promise<TNixeryRunResult> => {
  registerSigtermHook();
  await writeSharedOneCliOverride();

  let taskId = params.taskId?.trim() ?? '';

  if (!taskId && params.sessionId.trim()) {
    try {
      const session = await fetchSession(params.sessionId);

      taskId = session.taskId?.trim() ?? '';
    } catch {
      taskId = '';
    }
  }

  assertNamespaceWriteAllowed({ defId: params.defId, taskId });

  const def = await loadNixeryDef(params.defId);
  const sessionDir = resolveSessionNixeryDir(params.sessionId, params.defId);
  const containerName = resolveNixeryContainerName(params.sessionId, params.defId);
  const diagnosticsLogPath = resolveDiagnosticsLogPath(params.sessionId, params.defId);

  await fs.mkdir(sessionDir, { recursive: true });
  await fs.mkdir(path.dirname(diagnosticsLogPath), { recursive: true });
  await fs.appendFile(
    diagnosticsLogPath,
    `\n--- run ${new Date().toISOString()} def=${params.defId} container=${containerName} ---\n`,
    'utf8',
  );

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
  const sharedMount = {
    containerPath: '/opt/nixery/_shared',
    hostPath: path.join(resolveDockerHostRepoRoot(), 'server', 'nixery', '_shared'),
    mode: 'ro' as const,
  };
  const { cleanup, image } = await prepareNixeryImage({
    defId: params.defId,
    dockerfile: def.dockerfile,
    nixeryRoot: resolveNixeryRoot(),
    packages: def.packages,
  });

  console.log(
    `[nixery] run start def=${params.defId} sessionId=${params.sessionId} `
    + `container=${containerName} image=${image}`,
  );

  let stopLogStream: (() => void) | undefined;

  try {
    await runNixeryContainerDetached({
      containerName,
      entry: def.run.entry,
      env: {
        ...env,
        NIXERY_DEF_ID: params.defId,
      },
      image,
      volumeMounts: [...defMounts, sharedMount, ...oneCliMounts],
    });

    activeNixeryContainer = containerName;
    stopLogStream = startNixeryLogStream(containerName, diagnosticsLogPath);

    await waitForNixeryOutput({
      containerName,
      defId: params.defId,
      outputHint: typeof params.input.output === 'string' ? params.input.output : undefined,
      sessionDir,
    });
  } finally {
    stopLogStream?.();
    await cleanup();
  }

  console.log(
    `[nixery] run output ready def=${params.defId} sessionId=${params.sessionId} `
    + `container=${containerName}`,
  );

  if (!params.skipTeardown) {
    await teardownNixeryContainer(containerName, params.sessionId, params.defId);
  }

  return { containerName };
};

export const runNixeryStage = async (params: {
  defId: string;
  input: Record<string, unknown>;
  sessionId: string;
}) => {
  await runNixeryDef(params);
};
