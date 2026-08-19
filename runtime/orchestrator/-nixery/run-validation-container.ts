import { spawn } from 'node:child_process';
import path from 'node:path';

import { resolveNixeryOutputSpec } from '@project-yahl/shared/nixery/output-contract';

import { resolveDockerHostRepoRoot } from '@/orchestrator/-docker/paths';

import { loadNixeryDef } from './load-def';
import { resolveDockerHostSessionDir } from './resolve-mounts';
import { prepareNixeryImage } from './run-container';

import type { TNixeryValidationContext } from '@project-yahl/shared/nixery/load-validation';

export const NIXERY_VALIDATION_CLI_ENTRY = [
  'node',
  '/opt/nixery/validation-cli.mjs',
] as const;

const WORKSPACE_CONTAINER_PATH = '/workspace';
const DEF_CONTAINER_PATH = '/opt/nixery/def';
const VALIDATION_CLI_CONTAINER_PATH = '/opt/nixery/validation-cli.mjs';

const runDockerSync = (args: string[]) => new Promise<{
  code: number;
  stderr: string;
  stdout: string;
}>((resolve, reject) => {
  const child = spawn('docker', args, { stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '';
  let stderr = '';

  child.stdout?.on('data', (chunk) => {
    stdout += chunk.toString();
  });

  child.stderr?.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  child.on('error', reject);

  child.on('close', (code) => {
    resolve({
      code: code ?? -1,
      stderr: stderr.trim(),
      stdout: stdout.trim(),
    });
  });
});

export const buildNixeryValidationContext = (params: {
  defId: string;
  input: Record<string, unknown>;
  outputName: string;
}): TNixeryValidationContext => ({
  defId: params.defId,
  input: params.input,
  outputPath: `${WORKSPACE_CONTAINER_PATH}/${params.outputName}`,
  workspace: WORKSPACE_CONTAINER_PATH,
});

export const runNixeryValidationContainer = async (params: {
  defId: string;
  input: Record<string, unknown>;
  outputName: string;
  sessionDir: string;
}): Promise<{ ok: boolean; reason?: string }> => {
  const { def, location } = await loadNixeryDef(params.defId);
  const validateModule = resolveNixeryOutputSpec(def).validate;

  if (!validateModule.endsWith('.mjs')) {
    return { ok: true };
  }

  const validateModulePath = path.join(location.abilityDir, validateModule);

  try {
    const { access } = await import('node:fs/promises');
    await access(validateModulePath);
  } catch {
    return { ok: true };
  }

  const { image } = await prepareNixeryImage({
    packages: def.packages,
  });
  const repoRoot = resolveDockerHostRepoRoot();
  const hostSessionDir = resolveDockerHostSessionDir(params.sessionDir);
  const hostAbilityDir = path.join(
    repoRoot,
    'server',
    'nixery',
    location.pluginId,
    location.abilityId,
  );
  const hostValidationCli = path.join(
    repoRoot,
    'runtime',
    'orchestrator',
    '-nixery',
    'validation-cli.mjs',
  );
  const validateCtx = buildNixeryValidationContext({
    defId: params.defId,
    input: params.input,
    outputName: params.outputName,
  });
  const args = [
    'run',
    '--rm',
    '--network',
    process.env.RUNTIME_SHARED_NETWORK?.trim() || 'yahl_shared',
    '-e',
    `NIXERY_VALIDATE_CTX=${JSON.stringify(validateCtx)}`,
    '-v',
    `${hostSessionDir}:${WORKSPACE_CONTAINER_PATH}:ro`,
    '-v',
    `${hostAbilityDir}:${DEF_CONTAINER_PATH}:ro`,
    '-v',
    `${hostValidationCli}:${VALIDATION_CLI_CONTAINER_PATH}:ro`,
    image,
    ...NIXERY_VALIDATION_CLI_ENTRY,
  ];
  const result = await runDockerSync(args);

  if (result.code === 0) {
    return { ok: true };
  }

  return {
    ok: false,
    reason: result.stderr || `validation container exited ${result.code}`,
  };
};
