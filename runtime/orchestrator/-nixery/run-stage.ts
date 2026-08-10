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
import { clearStaleNixeryOutput, waitForNixeryOutput } from './validate-output';
import { assertNamespaceWriteAllowed } from '@project-yahl/shared/nixery/knowledge-write-gate';
import {
  resolveNixeryOutputHint,
  resolveNixeryOutputRetry,
} from '@project-yahl/shared/nixery/output-contract';
import { fetchSession } from '@/orchestrator/-ask-user/session-api';

export const resolveSessionNixeryDir = (sessionId: string, defId: string) =>
  path.join(workspaceRoot(), 'sessions', sessionId, 'nixery', defId);

export type TNixeryRunResult = {
  containerName: string;
};

export type TNixeryRetryState = {
  attempt: number;
  feedback?: string;
  isFinalAttempt: boolean;
  maxAttempts: number;
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

const resolveMaxAttempts = (defRetry: number) => (defRetry < 1 ? 1 : defRetry);

const writeSessionInput = async (
  sessionDir: string,
  input: Record<string, unknown>,
) => {
  await fs.writeFile(
    path.join(sessionDir, 'input.json'),
    `${JSON.stringify(input, null, 2)}\n`,
    'utf8',
  );
};

const readOkFalseError = async (
  sessionDir: string,
  outputHint: string,
): Promise<string | null> => {
  try {
    const raw = await fs.readFile(path.join(sessionDir, outputHint), 'utf8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    if (parsed?.ok !== false) {
      return null;
    }

    return typeof parsed.error === 'string' && parsed.error.trim()
      ? parsed.error.trim()
      : 'nixery failed';
  } catch {
    return null;
  }
};

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
  const maxAttempts = resolveMaxAttempts(resolveNixeryOutputRetry(def));
  const baseInput = { ...params.input };
  const outputHint = resolveNixeryOutputHint(def, baseInput);

  await fs.mkdir(sessionDir, { recursive: true });
  await fs.mkdir(path.dirname(diagnosticsLogPath), { recursive: true });
  await fs.appendFile(
    diagnosticsLogPath,
    `\n--- run ${new Date().toISOString()} def=${params.defId} container=${containerName} ---\n`,
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

  let stopLogStream: (() => void) | undefined;
  let lastError: unknown;
  let retryFeedback: string | undefined;

  try {
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const isFinalAttempt = attempt + 1 >= maxAttempts;
      const nixeryRetry: TNixeryRetryState = {
        attempt,
        isFinalAttempt,
        maxAttempts,
        ...(retryFeedback ? { feedback: retryFeedback } : {}),
      };

      await writeSessionInput(sessionDir, {
        ...baseInput,
        nixeryRetry,
      });

      await clearStaleNixeryOutput({
        defDefault: def.output?.default,
        outputHint,
        sessionDir,
      });

      console.log(
        `[nixery] run start def=${params.defId} sessionId=${params.sessionId} `
        + `container=${containerName} image=${image}`
        + ` attempt=${attempt + 1}/${maxAttempts}`,
      );

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
          outputHint,
          sessionDir,
        });

        const okFalseError = await readOkFalseError(sessionDir, outputHint);

        if (okFalseError && !isFinalAttempt) {
          stopLogStream?.();
          stopLogStream = undefined;
          await teardownNixeryContainer(containerName, params.sessionId, params.defId);
          retryFeedback = okFalseError;
          console.log(
            `[nixery] ok:false soft-fail; retry attempt=${attempt + 1}/${maxAttempts} `
            + `def=${params.defId} (${okFalseError})`,
          );
          continue;
        }

        lastError = undefined;
        break;
      } catch (error) {
        lastError = error;
        stopLogStream?.();
        stopLogStream = undefined;

        await teardownNixeryContainer(containerName, params.sessionId, params.defId);

        if (isFinalAttempt) {
          throw error;
        }

        const reason = error instanceof Error ? error.message : String(error);

        retryFeedback = reason;
        console.log(
          `[nixery] validation failed; retry attempt=${attempt + 1}/${maxAttempts} `
          + `def=${params.defId} (${reason})`,
        );
      }
    }
  } finally {
    stopLogStream?.();
    await cleanup();
  }

  if (lastError) {
    throw lastError;
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
